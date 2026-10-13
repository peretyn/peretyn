import { Result } from '@praha/byethrow';
import { isOwnerRole } from '@peretyn/org-roles';
import { getProjectById } from '../repositories/project.repository.js';
import { getMembership, Membership } from '../repositories/member.repository.js';
import { getEnvironmentByIdAndProjectId } from '../repositories/environment.repository.js';
import { DatabaseError } from '../db/database.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { Project } from '../domain/project.entity.js';
import { ActiveEnvironment, Environment, requireActive } from '../domain/environment.entity.js';

export function requireMembership(
  organizationId: string,
  userId: string,
): Result.ResultAsync<Membership, DatabaseError | NotFoundError> {
  return Result.pipe(
    getMembership(organizationId, userId),
    Result.andThen((membership) =>
      membership
        ? Result.succeed(membership)
        : Result.fail(new NotFoundError({ entity: 'project' })),
    ),
  );
}

export function assertOrgOwner(
  organizationId: string,
  userId: string,
): Result.ResultAsync<void, DatabaseError | ForbiddenError> {
  return Result.pipe(
    getMembership(organizationId, userId),
    Result.andThen((membership) =>
      isOwnerRole(membership?.role)
        ? Result.succeed()
        : Result.fail(
            new ForbiddenError({ reason: 'only organization owners can manage projects' }),
          ),
    ),
  );
}

export function assertProjectMembership(
  projectId: string,
  userId: string,
): Result.ResultAsync<Project, DatabaseError | NotFoundError> {
  return Result.pipe(
    Result.do(),
    Result.bind('project', () => getProjectById(projectId)),
    Result.andThrough(({ project }) => requireMembership(project.organizationId, userId)),
    Result.map(({ project }) => project),
  );
}

function restrictProductionToOwners(environment: Environment, membership: Membership) {
  return environment.isProduction && !isOwnerRole(membership.role)
    ? Result.fail(new ForbiddenError({ reason: 'production is restricted to organization owners' }))
    : Result.succeed({ environment, role: membership.role });
}

export function assertEnvironmentAccess(input: {
  projectId: string;
  envId: string;
  userId: string;
}): Result.ResultAsync<
  { environment: Environment; role: string },
  DatabaseError | NotFoundError | ForbiddenError
> {
  return Result.pipe(
    Result.do(),
    Result.bind('project', () => getProjectById(input.projectId)),
    Result.bind('membership', ({ project }) =>
      requireMembership(project.organizationId, input.userId),
    ),
    Result.bind('environment', () => getEnvironmentByIdAndProjectId(input.envId, input.projectId)),
    Result.andThen(({ membership, environment }) =>
      restrictProductionToOwners(environment, membership),
    ),
  );
}

export function resolveEnvironmentStore(input: {
  projectId: string;
  envId: string;
  userId: string;
}): Result.ResultAsync<
  ActiveEnvironment,
  DatabaseError | NotFoundError | ConflictError | ForbiddenError
> {
  return Result.pipe(
    assertEnvironmentAccess(input),
    Result.andThen(({ environment }) => requireActive(environment)),
  );
}
