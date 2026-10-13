import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';

const MAILPIT_IMAGE = 'axllent/mailpit:v1.31.5';
const MAILPIT_HTTP_PORT = 8025;
const CONTAINER_START_TIMEOUT_MS = 120_000;

type MailpitSummary = { ID: string; To: Array<{ Address: string }>; Subject: string };
type MailpitMessage = { Text: string; HTML: string; From: { Address: string } };

let mailpit: StartedTestContainer;
let mailpitUrl: string;

async function readJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, mailpitUrl));
  expect(res.ok).toBe(true);
  return (await res.json()) as T;
}

beforeAll(async () => {
  mailpit = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(MAILPIT_HTTP_PORT)
    .withWaitStrategy(Wait.forHttp('/livez', MAILPIT_HTTP_PORT))
    .start();
  mailpitUrl = `http://${mailpit.getHost()}:${mailpit.getMappedPort(MAILPIT_HTTP_PORT)}`;
}, CONTAINER_START_TIMEOUT_MS);

afterAll(async () => {
  await mailpit?.stop();
});

it('delivers a password reset to Mailpit with a working link', async () => {
  vi.stubEnv('PERETYN_MAILPIT_URL', mailpitUrl);
  vi.stubEnv('PERETYN_RESEND_API_KEY', '');
  vi.stubEnv('PERETYN_EMAIL_FROM', 'Peretyn <no-reply@mail.example.com>');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const { sendAuthEmail } = await import('./email.js');
  const url = 'https://app.example.com/auth/reset-password?token=abc&callbackURL=%2F';

  const sent = await sendAuthEmail({
    to: 'someone@example.com',
    subject: 'Reset your password',
    url,
  });
  expect(Result.isSuccess(sent)).toBe(true);

  const { messages } = await readJson<{ messages: MailpitSummary[] }>('/api/v1/messages');
  const [summary] = messages;
  expect(summary?.Subject).toBe('Reset your password');
  expect(summary?.To[0]?.Address).toBe('someone@example.com');
  const message = await readJson<MailpitMessage>(`/api/v1/message/${summary!.ID}`);
  expect(message.From.Address).toBe('no-reply@mail.example.com');
  expect(message.Text).toContain(url);
  expect(message.HTML).toContain(
    'href="https://app.example.com/auth/reset-password?token=abc&amp;callbackURL=%2F"',
  );
});
