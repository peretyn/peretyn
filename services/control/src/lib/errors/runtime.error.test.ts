import { describe, it, expect } from 'vitest';
import { RuntimeError, callerFacingStatus } from './runtime.error.js';
import { RuntimeResponseError } from '../runtime-client.js';

function runtimeError(inner?: Error) {
  return new RuntimeError({ operation: 'writeAuthorizationModel', error: inner });
}

describe('callerFacingStatus', () => {
  it('passes a malformed model through as 400 instead of our 502', () => {
    const error = runtimeError(new RuntimeResponseError(400, 'invalid relation reference'));
    expect(callerFacingStatus(error)).toBe(400);
  });

  it.each([404, 409, 422])('passes runtime %i through', (status) => {
    expect(callerFacingStatus(runtimeError(new RuntimeResponseError(status, 'x')))).toBe(status);
  });

  it.each([401, 403, 429])('leaves our own misconfiguration %i to the caller as 502', (status) => {
    expect(callerFacingStatus(runtimeError(new RuntimeResponseError(status, 'x')))).toBeNull();
  });

  it.each([500, 502, 503])('leaves engine failure %i to the caller as 502', (status) => {
    expect(callerFacingStatus(runtimeError(new RuntimeResponseError(status, 'x')))).toBeNull();
  });

  it('leaves a transport failure with no status as 502', () => {
    expect(callerFacingStatus(runtimeError(new Error('fetch failed')))).toBeNull();
    expect(callerFacingStatus(runtimeError())).toBeNull();
  });
});
