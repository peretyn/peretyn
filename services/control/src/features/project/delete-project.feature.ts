import { Result } from '@praha/byethrow';
import { assertOrgOwner, assertProjectMembership } from '../../services/authz.js';
import { deleteStores, revokeKeys } from '../../services/runtime-resources.js';
import { getEnvironmentsByProjectId } from '../../repositories/environment.repository.js';
import { deleteProject as deleteProjectRow } from '../../repositories/project.repository.js';
import { DatabaseError } from '../../db/database.error.js';
import { NotFoundError } from '../../errors/not-found.error.js';
import { ForbiddenError } from '../../errors/forbidden.error.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';

export async function deleteProject(input: {
  projectId: string;
  userId: string;
}): Result.ResultAsync<void, DatabaseError | NotFoundError | ForbiddenError | RuntimeError> {
  return Result.pipe(
    assertProjectMembership(input.projectId, input.userId),
    Result.andThrough((project) => assertOrgOwner(project.organizationId, input.userId)),
    Result.andThen(() => getEnvironmentsByProjectId(input.projectId)),
    Result.andThrough(revokeKeys),
    Result.andThrough(() => deleteProjectRow(input.projectId)),
    Result.andThen(async (environments) => {
      await deleteStores(environments);
      return Result.succeed();
    }),
  );
}
