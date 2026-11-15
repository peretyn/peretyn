import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pushSchema } from 'drizzle-kit/api';
import pg from 'pg';
import * as schema from '../db/schema.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { InvalidPasswordError } from '../errors/invalid-password.error.js';

const POSTGRES_IMAGE = 'postgres:16-alpine';
const CONTAINER_START_TIMEOUT_MS = 120_000;
const OLD_PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'staple-under-the-stairs';

let postgres: StartedTestContainer;
let auth: typeof import('../auth.js').auth;
let resetPassword: typeof import('./reset-password.js').resetPassword;

async function startPostgres(): Promise<string> {
  postgres = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_USER: 'peretyn',
      POSTGRES_PASSWORD: 'peretyn',
      POSTGRES_DB: 'peretyn',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  const url = `postgres://peretyn:peretyn@${postgres.getHost()}:${postgres.getMappedPort(5432)}/peretyn`;
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const database = drizzle(pool);
  await database.execute('CREATE SCHEMA IF NOT EXISTS peretyn_control');
  const { apply } = await pushSchema(schema, database, ['peretyn_control']);
  await apply();
  await pool.end();
  return url;
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  return auth.api.signInEmail({ body: { email, password } }).then(
    () => true,
    () => false,
  );
}

async function enrolledAdmin(email: string): Promise<string> {
  const { user } = await auth.api.createUser({
    body: {
      email,
      password: OLD_PASSWORD,
      name: 'Admin',
      role: 'admin',
      data: { emailVerified: true },
    },
  });
  return user.id;
}

beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', await startPostgres());
  vi.stubEnv('PERETYN_RESEND_API_KEY', '');
  vi.stubEnv('PERETYN_MAILPIT_URL', '');
  vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ({ auth } = await import('../auth.js'));
  ({ resetPassword } = await import('./reset-password.js'));
}, CONTAINER_START_TIMEOUT_MS);

afterAll(async () => {
  await postgres?.stop();
});

describe('resetPassword', () => {
  it('replaces the password, so only the new one signs in', async () => {
    await enrolledAdmin('admin-reset@example.com');

    const result = await resetPassword({
      email: 'admin-reset@example.com',
      password: NEW_PASSWORD,
    });

    expect(Result.isSuccess(result)).toBe(true);
    expect(await canSignIn('admin-reset@example.com', OLD_PASSWORD)).toBe(false);
    expect(await canSignIn('admin-reset@example.com', NEW_PASSWORD)).toBe(true);
  });

  it('signs out every existing session', async () => {
    const userId = await enrolledAdmin('admin-sessions@example.com');
    await auth.api.signInEmail({
      body: { email: 'admin-sessions@example.com', password: OLD_PASSWORD },
    });
    const context = await auth.$context;

    await resetPassword({ email: 'admin-sessions@example.com', password: NEW_PASSWORD });

    expect(await context.internalAdapter.listSessions(userId)).toEqual([]);
  });

  it('fails with NotFoundError for an unknown email', async () => {
    const result = await resetPassword({ email: 'nobody@example.com', password: NEW_PASSWORD });

    expect(Result.isFailure(result) && result.error).toBeInstanceOf(NotFoundError);
  });

  it('fails with InvalidPasswordError for a password that is too short', async () => {
    await enrolledAdmin('admin-short@example.com');

    const result = await resetPassword({ email: 'admin-short@example.com', password: 'short' });

    expect(Result.isFailure(result) && result.error).toBeInstanceOf(InvalidPasswordError);
    expect(await canSignIn('admin-short@example.com', OLD_PASSWORD)).toBe(true);
  });
});
