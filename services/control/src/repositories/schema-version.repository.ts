import { Result } from '@praha/byethrow';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema, Transaction } from '../db/index.js';
import { DatabaseError, isUniqueViolation } from '../db/database.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { SchemaVersion } from '../domain/schema-version.entity.js';

type InsertSchemaVersionInput = typeof schema.schemaVersion.$inferInsert;
type Executor = Transaction | ReturnType<typeof db>;

export function labelTaken(label: string): ConflictError {
  return new ConflictError({
    reason: `Label "${label}" is already published for this environment. Use a new label.`,
  });
}

const toReadError = (error: unknown) =>
  new DatabaseError({ entity: 'schemaVersion', operation: 'read', error: error as Error });

const toWriteError = (error: unknown) =>
  new DatabaseError({ entity: 'schemaVersion', operation: 'write', error: error as Error });

const toNoRowsInsertedError = () =>
  new DatabaseError({
    entity: 'schemaVersion',
    operation: 'write',
    error: new Error('insert returned no rows'),
  });

const toLockError = (error: unknown) =>
  new DatabaseError({ entity: 'schemaVersion', operation: 'write', error: error as Error });

export async function lockEnvironmentPublishes(
  environmentId: string,
  tx: Transaction,
): Result.ResultAsync<void, DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () =>
        tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${environmentId}, 0))`),
      catch: toLockError,
    }),
    Result.map(() => undefined),
  );
}

export async function insertSchemaVersion(
  input: InsertSchemaVersionInput,
  executor: Executor = db(),
): Result.ResultAsync<SchemaVersion, DatabaseError | ConflictError> {
  const row = { ...input, publishedAt: sql`clock_timestamp()` };
  return Result.pipe(
    Result.try({
      try: () => executor.insert(schema.schemaVersion).values(row).returning(),
      catch: (error) => (isUniqueViolation(error) ? labelTaken(input.label) : toWriteError(error)),
    }),
    Result.andThen(([row]) =>
      row === undefined ? Result.fail(toNoRowsInsertedError()) : Result.succeed(row),
    ),
  );
}

export async function getSchemaVersionsByEnvironmentId(
  environmentId: string,
): Result.ResultAsync<SchemaVersion[], DatabaseError> {
  return Result.try({
    try: () =>
      db()
        .select()
        .from(schema.schemaVersion)
        .where(eq(schema.schemaVersion.environmentId, environmentId))
        .orderBy(desc(schema.schemaVersion.publishedAt)),
    catch: toReadError,
  });
}

export async function getLatestSchemaVersionByEnvironmentId(
  environmentId: string,
): Result.ResultAsync<SchemaVersion | null, DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select()
          .from(schema.schemaVersion)
          .where(eq(schema.schemaVersion.environmentId, environmentId))
          .orderBy(desc(schema.schemaVersion.publishedAt))
          .limit(1),
      catch: toReadError,
    }),
    Result.map(([row]) => row ?? null),
  );
}

const selectSchemaVersionByLabel = (environmentId: string, label: string, executor: Executor) =>
  executor
    .select()
    .from(schema.schemaVersion)
    .where(
      and(
        eq(schema.schemaVersion.environmentId, environmentId),
        eq(schema.schemaVersion.label, label),
      ),
    );

export async function getSchemaVersionByLabel(
  environmentId: string,
  label: string,
  executor: Executor = db(),
): Result.ResultAsync<SchemaVersion | null, DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () => selectSchemaVersionByLabel(environmentId, label, executor),
      catch: toReadError,
    }),
    Result.map(([row]) => row ?? null),
  );
}
