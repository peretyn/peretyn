import { afterEach, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';

const url = 'https://dash.example/reset-password/SINGLE-USE-TOKEN';
const email = { to: 'someone@example.com', subject: 'Reset your password', url };

const resendSend = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

function captureLogs() {
  return (['log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
}

function loggedText(logs: ReturnType<typeof captureLogs>): string {
  return logs.flatMap((spy) => spy.mock.calls).join();
}

async function loadEmail(env: Record<string, string>) {
  vi.stubEnv('PERETYN_RESEND_API_KEY', '');
  vi.stubEnv('PERETYN_MAILPIT_URL', '');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return import('./email.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resendSend.mockReset();
});

it('warns at boot when production has no transport', async () => {
  const logs = captureLogs();
  await loadEmail({ NODE_ENV: 'production' });
  expect(loggedText(logs)).toContain('no_email_transport');
});

it('never logs the single-use url in production without a transport', async () => {
  const logs = captureLogs();
  const { sendAuthEmail } = await loadEmail({ NODE_ENV: 'production' });
  await sendAuthEmail(email);
  expect(loggedText(logs)).not.toContain('SINGLE-USE-TOKEN');
});

it('logs the url in development without a transport so the link can be followed', async () => {
  const logs = captureLogs();
  const { sendAuthEmail } = await loadEmail({ NODE_ENV: 'development' });
  await sendAuthEmail(email);
  expect(loggedText(logs)).toContain('SINGLE-USE-TOKEN');
});

it('refuses to boot with two transports configured', async () => {
  await expect(
    loadEmail({ PERETYN_RESEND_API_KEY: 're_key', PERETYN_MAILPIT_URL: 'http://mailpit:8025' }),
  ).rejects.toThrow(/only one/);
});

it('sends through Resend without logging the url', async () => {
  resendSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  const logs = captureLogs();
  const { sendAuthEmail } = await loadEmail({
    NODE_ENV: 'development',
    PERETYN_RESEND_API_KEY: 're_key',
  });
  const sent = await sendAuthEmail(email);
  expect(Result.isSuccess(sent)).toBe(true);
  expect(resendSend).toHaveBeenCalledWith(
    expect.objectContaining({ to: email.to, subject: email.subject }),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(loggedText(logs)).not.toContain('SINGLE-USE-TOKEN');
});

it('fails when Resend answers with an error', async () => {
  resendSend.mockResolvedValue({
    data: null,
    error: { name: 'validation_error', message: 'domain not verified', statusCode: 403 },
  });
  captureLogs();
  const { sendAuthEmail } = await loadEmail({ PERETYN_RESEND_API_KEY: 're_key' });
  const sent = await sendAuthEmail(email);
  expect(Result.isFailure(sent) && sent.error).toMatchObject({
    transport: 'resend',
    error: expect.objectContaining({ message: expect.stringMatching(/domain not verified/) }),
  });
});

it('fails when Mailpit answers with a failure status', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
  captureLogs();
  const { sendAuthEmail } = await loadEmail({ PERETYN_MAILPIT_URL: 'http://mailpit:8025' });
  const sent = await sendAuthEmail(email);
  expect(Result.isFailure(sent) && sent.error).toMatchObject({
    transport: 'mailpit',
    error: expect.objectContaining({ message: expect.stringMatching(/400/) }),
  });
});

it('fails when Mailpit does not answer in time', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
  );
  captureLogs();
  const { sendAuthEmail } = await loadEmail({ PERETYN_MAILPIT_URL: 'http://mailpit:8025' });
  const sent = await sendAuthEmail(email);
  expect(Result.isFailure(sent) && sent.error).toMatchObject({
    transport: 'mailpit',
    error: expect.objectContaining({ name: 'TimeoutError' }),
  });
});

it('fails instead of throwing when the Resend SDK throws', async () => {
  resendSend.mockRejectedValue(new TypeError('fetch failed'));
  captureLogs();
  const { sendAuthEmail } = await loadEmail({ PERETYN_RESEND_API_KEY: 're_key' });
  const sent = await sendAuthEmail(email);
  expect(Result.isFailure(sent) && sent.error).toMatchObject({ transport: 'resend' });
});

it('escapes the subject and url in the html body', async () => {
  resendSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  captureLogs();
  const { sendAuthEmail } = await loadEmail({ PERETYN_RESEND_API_KEY: 're_key' });
  await sendAuthEmail({
    to: email.to,
    subject: 'You have been invited to <script>alert(1)</script> on Peretyn',
    url: 'https://dash.example/accept?a=1&b="2"',
  });
  const [{ html }] = resendSend.mock.calls[0]!;
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('a=1&amp;b=&quot;2&quot;');
});
