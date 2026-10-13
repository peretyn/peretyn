import { Result } from '@praha/byethrow';
import { db, schema, Transaction } from '../db/index.js';
import { DatabaseError } from '../db/database.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { Environment } from '../domain/environment.entity.js';

const fromDbToDomain = (input: {
  id: string;
  projectId: string;
  name: string;
  openfgaStoreId: string | null;
  externalUuid: string;
  status: string;
  isProduction: boolean;
  createdAt: Date;
}): Environment => ({
  id: input.id,
  name: input.name,
  createdAt: input.createdAt,
  projectId: input.projectId,
  openfgaStoreId: input.openfgaStoreId ?? undefined,
  externalUuid: input.externalUuid,
  status: input.status,
  isProduction: input.isProduction,
});

const PRODUCTION_ENVIRONMENT_NAME = 'production';
const PENDING_ENVIRONMENT_STATUS = 'pending';

const toReadError = (error: unknown) =>
  new DatabaseError({ entity: 'environment', operation: 'read', error: error as Error });

const toWriteError = (error: unknown) =>
  new DatabaseError({ entity: 'environment', operation: 'write', error: error as Error });

const toCreationFailedError = () =>
  new DatabaseError({
    entity: 'environment',
    operation: 'write',
    error: new Error('Failed to create new environment, unknown error occurred'),
  });

const toNotFoundError = () => new NotFoundError({ entity: 'environment' });

const insertEnvironmentRow = (input: { projectId: string; name: string }, tx: Transaction) =>
  tx
    .insert(schema.environment)
    .values({
      projectId: input.projectId,
      name: input.name,
      isProduction: input.name === PRODUCTION_ENVIRONMENT_NAME,
      status: PENDING_ENVIRONMENT_STATUS,
    })
    .returning();

const updateEnvironmentRow = (
  input: { id: string; status: string; openfgaStoreId?: string },
  tx: Transaction,
) =>
  tx
    .update(schema.environment)
    .set({
      status: input.status,
      ...(input.openfgaStoreId !== undefined && { openfgaStoreId: input.openfgaStoreId }),
    })
    .where(eq(schema.environment.id, input.id))
    .returning();

export async function createEnvironment(
  input: { projectId: string; name: string },
  tx: Transaction,
): Promise<Result.Result<Environment, DatabaseError>> {
  return Result.pipe(
    Result.try({
      try: () => insertEnvironmentRow(input, tx),
      catch: toWriteError,
    }),
    Result.andThen(([environment]) =>
      environment === undefined
        ? Result.fail(toCreationFailedError())
        : Result.succeed(environment),
    ),
    Result.map(fromDbToDomain),
  );
}

export async function getEnvironmentsByProjectId(
  projectId: string,
): Promise<Result.Result<Environment[], DatabaseError>> {
  return Result.pipe(
    Result.try({
      try: () =>
        db().select().from(schema.environment).where(eq(schema.environment.projectId, projectId)),
      catch: toReadError,
    }),
    Result.map((rows) => rows.map(fromDbToDomain)),
  );
}

export async function getEnvironmentsByOrganizationId(
  organizationId: string,
): Promise<Result.Result<Environment[], DatabaseError>> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select(getTableColumns(schema.environment))
          .from(schema.environment)
          .innerJoin(schema.project, eq(schema.project.id, schema.environment.projectId))
          .where(eq(schema.project.organizationId, organizationId)),
      catch: toReadError,
    }),
    Result.map((rows) => rows.map(fromDbToDomain)),
  );
}

export async function getEnvironmentByStoreId(
  openfgaStoreId: string,
): Promise<Result.Result<Environment, DatabaseError | NotFoundError>> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select()
          .from(schema.environment)
          .where(eq(schema.environment.openfgaStoreId, openfgaStoreId)),
      catch: toReadError,
    }),
    Result.andThen(([env]) =>
      env === undefined ? Result.fail(toNotFoundError()) : Result.succeed(env),
    ),
    Result.map(fromDbToDomain),
  );
}

export async function getEnvironmentByIdAndProjectId(
  id: string,
  projectId: string,
): Promise<Result.Result<Environment, DatabaseError | NotFoundError>> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select()
          .from(schema.environment)
          .where(and(eq(schema.environment.id, id), eq(schema.environment.projectId, projectId))),
      catch: toReadError,
    }),
    Result.andThen(([env]) =>
      env === undefined ? Result.fail(toNotFoundError()) : Result.succeed(env),
    ),
    Result.map(fromDbToDomain),
  );
}

export async function updateEnvironment(
  input: { id: string; status: string; openfgaStoreId?: string },
  tx: Transaction,
): Result.ResultAsync<Environment, DatabaseError | NotFoundError> {
  return Result.pipe(
    Result.try({
      try: () => updateEnvironmentRow(input, tx),
      catch: toWriteError,
    }),
    Result.andThen(([environment]) =>
      environment === undefined ? Result.fail(toNotFoundError()) : Result.succeed(environment),
    ),
    Result.map(fromDbToDomain),
  );
}
