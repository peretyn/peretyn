import { Result } from '@praha/byethrow';
import { db, schema, Transaction } from '../db/index.js';
import { DatabaseError, isUniqueViolation } from '../db/database.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { Project } from '../domain/project.entity.js';
import { eq } from 'drizzle-orm';

const toReadError = (error: unknown) =>
  new DatabaseError({ entity: 'project', operation: 'read', error: error as Error });

const toWriteError = (error: unknown) =>
  new DatabaseError({ entity: 'project', operation: 'write', error: error as Error });

const toCreationFailedError = () =>
  new DatabaseError({
    entity: 'project',
    operation: 'write',
    error: new Error('Failed to create new project, unknown error occurred'),
  });

export async function createProject(
  input: { organizationId: string; slug: string; name: string },
  tx: Transaction,
): Promise<Result.Result<Project, DatabaseError | ConflictError>> {
  return Result.pipe(
    Result.try({
      try: () => tx.insert(schema.project).values(input).returning(),
      catch: (error) =>
        isUniqueViolation(error)
          ? new ConflictError({
              reason: `A project with the slug "${input.slug}" already exists in this organization.`,
            })
          : toWriteError(error),
    }),
    Result.andThen(([project]) =>
      project === undefined ? Result.fail(toCreationFailedError()) : Result.succeed(project),
    ),
  );
}

export async function getProjectsByOrganizationId(
  organizationId: string,
): Result.ResultAsync<Project[], DatabaseError> {
  return Result.try({
    try: () =>
      db().select().from(schema.project).where(eq(schema.project.organizationId, organizationId)),
    catch: toReadError,
  });
}

export async function getProjectById(
  id: string,
): Result.ResultAsync<Project, DatabaseError | NotFoundError> {
  return Result.pipe(
    Result.try({
      try: () => db().select().from(schema.project).where(eq(schema.project.id, id)),
      catch: toReadError,
    }),
    Result.andThen(([project]) =>
      project === undefined
        ? Result.fail(new NotFoundError({ entity: 'project' }))
        : Result.succeed(project),
    ),
  );
}

export function deleteProject(id: string): Result.ResultAsync<void, DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () => db().delete(schema.project).where(eq(schema.project.id, id)),
      catch: toWriteError,
    }),
    Result.map(() => undefined),
  );
}
