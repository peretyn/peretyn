import { Result } from '@praha/byethrow';
import { NotFoundError } from '../../errors/not-found.error.js';
import { createProject } from '../../repositories/project.repository.js';
import { runtimeClient } from '../../lib/runtime-client.js';
import { transactional, Transaction } from '../../db/index.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { createEnvironment, updateEnvironment } from '../../repositories/environment.repository.js';
import { insertApiToken } from '../../repositories/api-token.repository.js';
import { DatabaseError } from '../../db/database.error.js';
import { ConflictError } from '../../errors/conflict.error.js';
import { Environment } from '../../domain/environment.entity.js';
import {
  discardCreatedResources,
  type RuntimeResources,
} from '../../services/runtime-resources.js';

type CreateNewProjectInput = {
  organizationId: string;
  slug: string;
  name: string;
};

type BootstrappedEnvironment = {
  env: Environment;
  plaintext: string;
};

type CreationContext = {
  tx: Transaction;
  created: RuntimeResources[];
};

type CreateNewProjectResult = {
  project: { id: string; name: string; slug: string; createdAt: Date; organizationId: string };
  production: BootstrappedEnvironment;
  development: BootstrappedEnvironment;
};

export async function createNewProject(
  input: CreateNewProjectInput,
): Result.ResultAsync<
  CreateNewProjectResult,
  DatabaseError | NotFoundError | RuntimeError | ConflictError
> {
  const created: RuntimeResources[] = [];
  let committed = false;
  try {
    const result = await transactional((tx) => handleProjectCreation(input, { tx, created }));
    committed = Result.isSuccess(result);
    return result;
  } finally {
    if (!committed && created.length > 0) await discardCreatedResources(created);
  }
}

async function handleProjectCreation(input: CreateNewProjectInput, context: CreationContext) {
  const bootstrapNamedEnvironment = (projectId: string, name: string) =>
    bootstrapEnvironment({ projectId, name, projectSlug: input.slug }, context);
  return Result.pipe(
    Result.do(),
    Result.bind('project', () => createProject(input, context.tx)),
    Result.bind('production', ({ project }) => bootstrapNamedEnvironment(project.id, 'production')),
    Result.bind('development', ({ project }) =>
      bootstrapNamedEnvironment(project.id, 'development'),
    ),
  );
}

function recordCreatedResources(
  created: RuntimeResources[],
  environment: Environment,
  storeId: string,
) {
  created.push({ externalUuid: environment.externalUuid, openfgaStoreId: storeId });
  return Result.succeed();
}

function activateEnvironment(
  { environment, store }: { environment: Environment; store: { id: string } },
  tx: Transaction,
) {
  return updateEnvironment({ id: environment.id, status: 'active', openfgaStoreId: store.id }, tx);
}

function recordApiToken(
  environment: Environment,
  apiKey: { prefix: string; last4: string },
  tx: Transaction,
) {
  return insertApiToken(
    { environmentId: environment.id, prefix: apiKey.prefix, keyLast4: apiKey.last4 },
    tx,
  );
}

async function bootstrapEnvironment(
  { projectId, name, projectSlug }: { projectId: string; name: string; projectSlug: string },
  { tx, created }: CreationContext,
): Result.ResultAsync<BootstrappedEnvironment, DatabaseError | NotFoundError | RuntimeError> {
  return Result.pipe(
    Result.do(),
    Result.bind('environment', () => createEnvironment({ projectId, name }, tx)),
    Result.bind('store', ({ environment }) => createRuntimeStore(environment)),
    Result.andThrough(({ environment, store }) =>
      recordCreatedResources(created, environment, store.id),
    ),
    Result.bind('apiKey', ({ environment, store }) =>
      createRuntimeKey(environment, store.id, projectSlug),
    ),
    Result.andThrough(({ environment, apiKey }) => recordApiToken(environment, apiKey, tx)),
    Result.bind('active', (steps) => activateEnvironment(steps, tx)),
    Result.map(({ active, apiKey }) => ({ env: active, plaintext: apiKey.plaintext })),
  );
}

function createRuntimeStore(environment: Environment) {
  return Result.try({
    try: () => runtimeClient().createStore(`peretyn-env-${environment.externalUuid}`),
    catch: (error) => new RuntimeError({ operation: 'createStore', error: error as Error }),
  });
}

function createRuntimeKey(environment: Environment, storeId: string, projectSlug: string) {
  return Result.try({
    try: () =>
      runtimeClient().createKey({
        environmentUuid: environment.externalUuid,
        storeId,
        projectSlug,
        environmentName: environment.name,
      }),
    catch: (error) => new RuntimeError({ operation: 'createKey', error: error as Error }),
  });
}
