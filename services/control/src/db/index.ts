import { drizzle, NodePgQueryResultHKT, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { Result } from '@praha/byethrow';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { ExtractTablesWithRelations, Relations } from 'drizzle-orm';
import { logError } from '../lib/log.js';

const { Pool } = pg;
type Pool = pg.Pool;

type Database = NodePgDatabase<typeof schema>;
export type PeretynControlSchema = {
  [K in keyof typeof schema as (typeof schema)[K] extends Relations
    ? never
    : K]: (typeof schema)[K];
};
export type Transaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

let cached: { pool: Pool; db: Database } | null = null;

export function db(): Database {
  if (cached) return cached.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 });
  pool.on('error', (error) => logError('idle database client error', { error }));
  const database = drizzle(pool, { schema });
  cached = { pool, db: database };
  return database;
}

export async function closeDb(): Promise<void> {
  await cached?.pool.end();
  cached = null;
}

class Rollback<E> extends Error {
  constructor(readonly failure: Result.Result<never, E>) {
    super('transaction rolled back');
  }
}

export async function transactional<T, E>(
  callback: (tx: Transaction) => Result.ResultAsync<T, E>,
): Result.ResultAsync<T, E> {
  try {
    return await db().transaction(async (tx) => {
      const result = await callback(tx);
      if (Result.isFailure(result)) throw new Rollback(result);
      return result;
    });
  } catch (thrown) {
    if (thrown instanceof Rollback) return thrown.failure as Result.Result<T, E>;
    throw thrown;
  }
}

export { schema };
