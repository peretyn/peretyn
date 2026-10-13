import { Result } from '@praha/byethrow';
import { getEnvironmentByIdAndProjectId } from '../../repositories/environment.repository.js';
import { updateApiTokenRotation } from '../../repositories/api-token.repository.js';
import { NotFoundError } from '../../errors/not-found.error.js';
import { ConflictError } from '../../errors/conflict.error.js';
import { runtimeClient } from '../../lib/runtime-client.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { DatabaseError } from '../../db/database.error.js';
import { logError } from '../../lib/log.js';
import { Environment, requireActive } from '../../domain/environment.entity.js';

type RotateEnvironmentKeyInput = {
  projectId: string;
  envId: string;
};

type RotateEnvironmentKeyResult = {
  plaintext: string;
  prefix: string;
  last4: string;
};

function rotateRuntimeKey(environment: Environment) {
  return Result.try({
    try: () => runtimeClient().rotateKey(environment.externalUuid),
    catch: (error) => new RuntimeError({ operation: 'rotateKey', error: error as Error }),
  });
}

function recordRotation(envId: string, last4: string) {
  return Result.pipe(
    updateApiTokenRotation(envId, last4),
    Result.orElse((error) => {
      logError('rotate metadata stale: runtime key rotated but DB update failed', {
        envId,
        error: error.error ?? error,
      });
      return Result.succeed();
    }),
  );
}

export async function rotateEnvironmentKey(
  input: RotateEnvironmentKeyInput,
): Result.ResultAsync<
  RotateEnvironmentKeyResult,
  DatabaseError | NotFoundError | ConflictError | RuntimeError
> {
  return Result.pipe(
    getEnvironmentByIdAndProjectId(input.envId, input.projectId),
    Result.andThen(requireActive),
    Result.andThen(rotateRuntimeKey),
    Result.andThrough((apiKey) => recordRotation(input.envId, apiKey.last4)),
  );
}
