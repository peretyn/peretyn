import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { errorResponse } from './respond.js';
import { RuntimeError } from './errors/runtime.error.js';

describe('errorResponse', () => {
  it('tells the caller that keys may already be revoked when revocation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = new Hono().get('/', (c) =>
      errorResponse(
        c,
        new RuntimeError({ operation: 'deleteKey', error: new TypeError('fetch failed') }),
      ),
    );
    const res = await app.request('/');
    expect(res.status).toBe(502);
    const { message } = (await res.json()) as { message: string };
    expect(message).toMatch(/may already be revoked/);
    expect(message).toMatch(/retry/i);
  });

  it('keeps the generic message for other runtime failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = new Hono().get('/', (c) =>
      errorResponse(
        c,
        new RuntimeError({ operation: 'createStore', error: new TypeError('fetch failed') }),
      ),
    );
    const res = await app.request('/');
    expect(await res.json()).toEqual({ message: 'runtime request failed' });
  });
});
