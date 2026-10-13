import { expect, it, vi } from 'vitest';
import type pg from 'pg';

it('logs an idle client error instead of crashing the process', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://nobody@127.0.0.1:1/none');
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { db } = await import('./index.js');
  const pool = (db() as unknown as { $client: pg.Pool }).$client;

  expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
  expect(logged.mock.calls.flat().join()).toContain('terminating connection');
});
