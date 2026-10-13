import { Result } from '@praha/byethrow';
import { getEnvironmentsByOrganizationId } from '../repositories/environment.repository.js';
import { releaseRuntimeResources } from './runtime-resources.js';
import { DatabaseError } from '../db/database.error.js';
import { RuntimeError } from '../lib/errors/runtime.error.js';

export function releaseOrganization(
  organizationId: string,
): Result.ResultAsync<void, DatabaseError | RuntimeError> {
  return Result.pipe(
    getEnvironmentsByOrganizationId(organizationId),
    Result.andThen(releaseRuntimeResources),
  );
}
