import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';
import { toAuthError, unwrapOrThrowAuthError } from './auth-error.js';
import { RuntimeError } from './errors/runtime.error.js';
import { DatabaseError } from '../db/database.error.js';
import { SoleOwnerError } from '../errors/sole-owner.error.js';
import { EmailDeliveryError } from './errors/email-delivery.error.js';

const soleOwner = new SoleOwnerError({ organizations: [{ id: 'a', name: 'Acme' }] });
const revokeFailure = new RuntimeError({
  operation: 'deleteKey',
  error: new TypeError('fetch failed'),
});

describe('toAuthError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('refuses a sole owner with a 4xx that keeps the business message', () => {
    const error = toAuthError(soleOwner);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe(soleOwner.message);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('tells the caller that keys may already be revoked when revocation fails', () => {
    const error = toAuthError(revokeFailure);
    expect(error.statusCode).toBe(502);
    expect(error.message).toMatch(/may already be revoked/);
    expect(error.message).toMatch(/retry/i);
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps the generic message for other runtime failures', () => {
    const error = toAuthError(new RuntimeError({ operation: 'createStore' }));
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('runtime request failed');
  });

  it('answers a failed email with a 502 that hides the provider error and logs it', () => {
    const cause = new Error('validation_error: domain not verified');
    const error = toAuthError(new EmailDeliveryError({ transport: 'resend', error: cause }));
    expect(error.statusCode).toBe(502);
    expect(error.message).not.toContain('domain not verified');
    expect(consoleError.mock.calls.flat().join()).toContain('domain not verified');
  });

  it('hides the database failure behind an internal error and logs it', () => {
    const cause = new Error('connection refused to 10.0.0.5');
    const error = toAuthError(
      new DatabaseError({ entity: 'member', operation: 'read', error: cause }),
    );
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('internal error');
    expect(consoleError.mock.calls.flat().join()).toContain('connection refused');
  });
});

describe('unwrapOrThrowAuthError', () => {
  it('returns the value of a success', async () => {
    await expect(unwrapOrThrowAuthError(Promise.resolve(Result.succeed('kept')))).resolves.toBe(
      'kept',
    );
  });

  it('throws the translated error of a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      unwrapOrThrowAuthError(Promise.resolve(Result.fail(revokeFailure))),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
