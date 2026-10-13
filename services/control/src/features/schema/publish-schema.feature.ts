import { Result } from '@praha/byethrow';
import {
  getSchemaVersionByLabel,
  insertSchemaVersion,
  labelTaken,
  lockEnvironmentPublishes,
} from '../../repositories/schema-version.repository.js';
import { transactional, Transaction } from '../../db/index.js';
import { ConflictError } from '../../errors/conflict.error.js';
import { runtimeClient } from '../../lib/runtime-client.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { DatabaseError } from '../../db/database.error.js';
import { SchemaVersion } from '../../domain/schema-version.entity.js';
import { OpenFGAModel } from '../../lib/openfga-model.js';
import { Environment, requireActive } from '../../domain/environment.entity.js';

type PublishSchemaInput = {
  environment: Environment;
  label: string;
  model: OpenFGAModel;
  dsl: string;
  publishedBy: string;
};

function assertLabelAvailable(input: PublishSchemaInput, tx: Transaction) {
  return Result.pipe(
    getSchemaVersionByLabel(input.environment.id, input.label, tx),
    Result.andThen((existing) =>
      existing ? Result.fail(labelTaken(input.label)) : Result.succeed(),
    ),
  );
}

function writeAuthorizationModel(storeId: string, model: OpenFGAModel) {
  return Result.try({
    try: () => runtimeClient().writeAuthorizationModel(storeId, model),
    catch: (error) =>
      new RuntimeError({ operation: 'writeAuthorizationModel', error: error as Error }),
  });
}

function recordSchemaVersion(
  input: PublishSchemaInput,
  authorizationModelId: string,
  tx: Transaction,
) {
  return insertSchemaVersion(
    {
      environmentId: input.environment.id,
      label: input.label,
      dslSource: input.dsl,
      modelJson: input.model,
      openfgaAuthorizationModelId: authorizationModelId,
      publishedBy: input.publishedBy,
    },
    tx,
  );
}

function publishUnderEnvironmentLock(input: PublishSchemaInput, storeId: string) {
  return transactional((tx) =>
    Result.pipe(
      lockEnvironmentPublishes(input.environment.id, tx),
      Result.andThrough(() => assertLabelAvailable(input, tx)),
      Result.andThen(() => writeAuthorizationModel(storeId, input.model)),
      Result.andThen(({ authorizationModelId }) =>
        recordSchemaVersion(input, authorizationModelId, tx),
      ),
    ),
  );
}

export async function publishSchema(
  input: PublishSchemaInput,
): Result.ResultAsync<SchemaVersion, DatabaseError | ConflictError | RuntimeError> {
  return Result.pipe(
    requireActive(input.environment),
    Result.andThen((env) => publishUnderEnvironmentLock(input, env.openfgaStoreId)),
  );
}
