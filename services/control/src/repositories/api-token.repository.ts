import { Result } from '@praha/byethrow';
import { db, schema, Transaction } from '../db/index.js';
import { DatabaseError } from '../db/database.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { eq } from 'drizzle-orm';
import { ApiToken } from '../domain/api-token.entity.js';

const toReadError = (error: unknown) =>
  new DatabaseError({ entity: 'apiTokenMetadata', operation: 'read', error: error as Error });

const toWriteError = (error: unknown) =>
  new DatabaseError({ entity: 'apiTokenMetadata', operation: 'write', error: error as Error });

const toMissingRowError = (message: string) =>
  new DatabaseError({
    entity: 'apiTokenMetadata',
    operation: 'write',
    error: new Error(message),
  });

export async function insertApiToken(
  input: { environmentId: string; prefix: string; keyLast4: string },
  tx: Transaction,
): Promise<Result.Result<ApiToken, DatabaseError>> {
  return Result.pipe(
    Result.try({
      try: () => tx.insert(schema.apiTokenMetadata).values(input).returning(),
      catch: toWriteError,
    }),
    Result.andThen(([row]) =>
      row === undefined
        ? Result.fail(toMissingRowError('Failed to insert api token'))
        : Result.succeed(row),
    ),
  );
}

export async function getApiTokenByEnvironmentId(
  environmentId: string,
): Promise<Result.Result<ApiToken, DatabaseError | NotFoundError>> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select()
          .from(schema.apiTokenMetadata)
          .where(eq(schema.apiTokenMetadata.environmentId, environmentId)),
      catch: toReadError,
    }),
    Result.andThen(([row]) =>
      row === undefined
        ? Result.fail(new NotFoundError({ entity: 'apiTokenMetadata' }))
        : Result.succeed(row),
    ),
  );
}

const rotateApiTokenRow = (environmentId: string, keyLast4: string) =>
  db()
    .update(schema.apiTokenMetadata)
    .set({ keyLast4, rotatedAt: new Date() })
    .where(eq(schema.apiTokenMetadata.environmentId, environmentId))
    .returning();

export async function updateApiTokenRotation(
  environmentId: string,
  keyLast4: string,
): Promise<Result.Result<ApiToken, DatabaseError>> {
  return Result.pipe(
    Result.try({
      try: () => rotateApiTokenRow(environmentId, keyLast4),
      catch: toWriteError,
    }),
    Result.andThen(([row]) =>
      row === undefined
        ? Result.fail(toMissingRowError('Failed to update api token'))
        : Result.succeed(row),
    ),
  );
}
