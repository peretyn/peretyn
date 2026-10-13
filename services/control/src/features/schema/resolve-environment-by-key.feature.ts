import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { runtimeClient, RuntimeResponseError } from '../../lib/runtime-client.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { getEnvironmentByStoreId } from '../../repositories/environment.repository.js';
import { DatabaseError } from '../../db/database.error.js';
import { NotFoundError } from '../../errors/not-found.error.js';
import { ForbiddenError } from '../../errors/forbidden.error.js';
import { Environment } from '../../domain/environment.entity.js';

const REJECTED_KEY_STATUSES: number[] = [StatusCodes.UNAUTHORIZED, StatusCodes.FORBIDDEN];

function toKeyResolutionError(error: unknown) {
  const isRejectedKey =
    error instanceof RuntimeResponseError && REJECTED_KEY_STATUSES.includes(error.status);
  return isRejectedKey
    ? new ForbiddenError({ reason: 'invalid or unknown env key' })
    : new RuntimeError({ operation: 'resolveKey', error: error as Error });
}

export async function resolveEnvironmentByKey(
  key: string,
): Result.ResultAsync<Environment, DatabaseError | NotFoundError | ForbiddenError | RuntimeError> {
  return Result.pipe(
    Result.try({
      try: () => runtimeClient().resolveKey(key),
      catch: toKeyResolutionError,
    }),
    Result.andThen((scope) =>
      scope.storeId
        ? getEnvironmentByStoreId(scope.storeId)
        : Result.fail(new ForbiddenError({ reason: 'key is not scoped to a store' })),
    ),
  );
}
