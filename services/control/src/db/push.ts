import { drizzle } from 'drizzle-orm/node-postgres';
import { pushSchema } from 'drizzle-kit/api';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: url, max: 2 });
const db = drizzle(pool);

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ component: 'control-push', msg, ...extra }));

log('starting');
await db.execute('CREATE SCHEMA IF NOT EXISTS peretyn_control');

const { hasDataLoss, warnings, statementsToExecute, apply } = await pushSchema(schema, db, [
  'peretyn_control',
]);

for (const warning of warnings) log('warning', { warning });

if (hasDataLoss) {
  log('aborted: destructive statements', { statementsToExecute });
  await pool.end();
  process.exit(1);
}

await apply();
log('done', { applied: statementsToExecute.length });
await pool.end();
