import { afterEach, describe, expect, it, vi } from 'vitest';

async function authSettings(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const { authSettingsRoute } = await import('./auth-settings.js');
  const response = await authSettingsRoute.request('/');
  return { status: response.status, body: await response.json() };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /public/v1/auth-settings', () => {
  it('reports sign-up and password reset off on a default self-host', async () => {
    const result = await authSettings({
      NODE_ENV: 'production',
      PERETYN_ALLOW_SIGNUP: '',
      PERETYN_RESEND_API_KEY: '',
      PERETYN_MAILPIT_URL: '',
    });
    expect(result).toEqual({ status: 200, body: { signUp: false, passwordReset: false } });
  });

  it('reports sign-up on when PERETYN_ALLOW_SIGNUP is true', async () => {
    const result = await authSettings({
      NODE_ENV: 'production',
      PERETYN_ALLOW_SIGNUP: 'true',
      PERETYN_RESEND_API_KEY: 're_test',
      PERETYN_MAILPIT_URL: '',
    });
    expect(result.body).toEqual({ signUp: true, passwordReset: true });
  });

  it('reports password reset on when an email transport is configured', async () => {
    const result = await authSettings({
      NODE_ENV: 'production',
      PERETYN_ALLOW_SIGNUP: '',
      PERETYN_RESEND_API_KEY: '',
      PERETYN_MAILPIT_URL: 'http://localhost:8025',
    });
    expect(result.body).toEqual({ signUp: false, passwordReset: true });
  });
});
