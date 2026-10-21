import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pushSchema } from 'drizzle-kit/api';
import pg from 'pg';
import * as schema from './db/schema.js';

const POSTGRES_IMAGE = 'postgres:16-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit:v1.31.5';
const MAILPIT_HTTP_PORT = 8025;
const CONTAINER_START_TIMEOUT_MS = 120_000;
const MAIL_WAIT_MS = 5_000;
const TEST_TIMEOUT_MS = 20_000;
const PASSWORD = 'correct-horse-battery';
const DASHBOARD_URL = 'https://app.example.com';

type MailpitSummary = { ID: string; Subject: string };
type MailpitMessage = { Subject: string; Text: string; To: Array<{ Address: string }> };

let postgres: StartedTestContainer;
let mailpit: StartedTestContainer;
let mailpitUrl: string;
let auth: typeof import('./auth.js').auth;

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

async function startMailpit(): Promise<string> {
  mailpit = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(MAILPIT_HTTP_PORT)
    .withWaitStrategy(Wait.forHttp('/livez', MAILPIT_HTTP_PORT))
    .start();
  return `http://${mailpit.getHost()}:${mailpit.getMappedPort(MAILPIT_HTTP_PORT)}`;
}

async function inbox(address: string): Promise<MailpitMessage[]> {
  const search = new URL('/api/v1/search', mailpitUrl);
  search.searchParams.set('query', `to:"${address}"`);
  const { messages } = (await (await fetch(search)).json()) as { messages: MailpitSummary[] };
  return Promise.all(
    messages.map(
      async ({ ID }) =>
        (await (
          await fetch(new URL(`/api/v1/message/${ID}`, mailpitUrl))
        ).json()) as MailpitMessage,
    ),
  );
}

async function mailTo(address: string, subject: string): Promise<MailpitMessage> {
  const deadline = Date.now() + MAIL_WAIT_MS;
  for (;;) {
    const found = (await inbox(address)).find((message) => message.Subject === subject);
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`no "${subject}" email for ${address}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function linkIn(message: MailpitMessage): string {
  const link = message.Text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no link in "${message.Subject}"`);
  return link;
}

async function signIn(email: string, password = PASSWORD): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  return new Headers({ cookie });
}

function follow(link: string, headers?: Headers): Promise<Response> {
  return auth.handler(new Request(link, { headers }));
}

async function enrolledUser(email: string): Promise<void> {
  await auth.api.createUser({
    body: { email, password: PASSWORD, name: 'Enrolled', data: { emailVerified: true } },
  });
}

vi.setConfig({ testTimeout: TEST_TIMEOUT_MS });

let sequence = 0;
const uniqueEmail = (label: string) => `${label}-${++sequence}@example.com`;

beforeAll(async () => {
  const [databaseUrl, mailUrl] = await Promise.all([startPostgres(), startMailpit()]);
  mailpitUrl = mailUrl;
  vi.stubEnv('DATABASE_URL', databaseUrl);
  vi.stubEnv('PERETYN_MAILPIT_URL', mailpitUrl);
  vi.stubEnv('PERETYN_RESEND_API_KEY', '');
  vi.stubEnv('PERETYN_DASHBOARD_URL', DASHBOARD_URL);
  vi.stubEnv('PERETYN_ALLOW_SIGNUP', 'true');
  vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ({ auth } = await import('./auth.js'));
}, CONTAINER_START_TIMEOUT_MS);

afterAll(async () => {
  const { closeDb } = await import('./db/index.js');
  await closeDb();
  await Promise.all([postgres?.stop(), mailpit?.stop()]);
});

beforeEach(async () => {
  await fetch(new URL('/api/v1/messages', mailpitUrl), { method: 'DELETE' });
});

describe('sign-up', () => {
  it('emails a verification link and blocks sign-in until it is followed', async () => {
    const email = uniqueEmail('signup');
    await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: 'New' } });

    const verification = await mailTo(email, 'Verify your email');
    await expect(signIn(email)).rejects.toMatchObject({
      body: { code: 'EMAIL_NOT_VERIFIED' },
    });

    await follow(linkIn(verification));
    await expect(signIn(email)).resolves.toBeInstanceOf(Headers);
  });

  it('lets an enrolled user sign in without any email', async () => {
    const email = uniqueEmail('enrolled');
    await enrolledUser(email);

    await expect(signIn(email)).resolves.toBeInstanceOf(Headers);
    expect(await inbox(email)).toEqual([]);
  });
});

describe('password reset', () => {
  it('tells the account its password was changed', async () => {
    const email = uniqueEmail('reset');
    await enrolledUser(email);
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/' } });
    const token = new URL(linkIn(await mailTo(email, 'Reset your password'))).pathname
      .split('/')
      .at(-1)!;

    await auth.api.resetPassword({ body: { token, newPassword: 'a-brand-new-password' } });

    const notice = await mailTo(email, 'Your Peretyn password was changed');
    expect(notice.Text).toContain(`${DASHBOARD_URL}/auth/forgot-password`);
    await expect(signIn(email)).rejects.toBeDefined();
  });
});

describe('email change', () => {
  it('asks the old address to confirm before verifying the new one', async () => {
    const email = uniqueEmail('old');
    const newEmail = uniqueEmail('new');
    await enrolledUser(email);
    const session = await signIn(email);

    await auth.api.changeEmail({ body: { newEmail, callbackURL: '/' }, headers: session });

    const confirmation = await mailTo(email, 'Confirm your email change');
    expect(confirmation.Text).toContain(newEmail);
    expect(await inbox(newEmail)).toEqual([]);

    await follow(linkIn(confirmation), session);
    await follow(linkIn(await mailTo(newEmail, 'Verify your email')), session);
    await expect(signIn(newEmail)).resolves.toBeInstanceOf(Headers);
  });
});

describe('account deletion', () => {
  it('deletes the account only after the emailed link is followed', async () => {
    const email = uniqueEmail('delete');
    await enrolledUser(email);
    const session = await signIn(email);

    await auth.api.deleteUser({ body: {}, headers: session });

    const confirmation = await mailTo(email, 'Confirm deleting your Peretyn account');
    await expect(signIn(email)).resolves.toBeInstanceOf(Headers);

    await follow(linkIn(confirmation), session);
    await expect(signIn(email)).rejects.toBeDefined();
  });
});
