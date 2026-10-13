import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlError, controlFetch } from './client';

function respond(body: string | null, init: ResponseInit = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, init)));
}

const json = { 'Content-Type': 'application/json' };
const html = { 'Content-Type': 'text/html; charset=utf-8' };

describe('controlFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the parsed JSON body', async () => {
    respond(JSON.stringify([{ id: 'p1' }]), { status: 200, headers: json });
    await expect(controlFetch('/projects')).resolves.toEqual([{ id: 'p1' }]);
  });

  it('returns null for 204 No Content', async () => {
    respond(null, { status: 204 });
    await expect(controlFetch('/projects/p1', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('throws the server message with its status', async () => {
    respond(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: json });
    await expect(controlFetch('/projects')).rejects.toMatchObject({
      name: 'ControlError',
      status: 401,
      message: 'Unauthorized',
    });
  });

  it('keeps the status when an error body labelled JSON is empty', async () => {
    respond('', { status: 401, headers: json });
    await expect(controlFetch('/projects')).rejects.toMatchObject({
      name: 'ControlError',
      status: 401,
      message: 'Request failed (401)',
    });
  });

  it('rejects a 200 that is not JSON', async () => {
    respond('<!doctype html>', { status: 200, headers: html });
    await expect(controlFetch('/projects')).rejects.toBeInstanceOf(ControlError);
  });

  it('falls back to a generic message for a non-JSON error', async () => {
    respond('<!doctype html>', { status: 502, headers: html });
    await expect(controlFetch('/projects')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (502)',
    });
  });
});
