import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('withToken', () => {
  it('returns a new client that uses the new token', async () => {
    const fetch = captureFetch({ allowed: true });
    const client = peretyn({ token: 'original-token', fetch });
    const client2 = client.withToken('new-token');
    await client2.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.init.headers).toMatchObject({ Authorization: 'Bearer new-token' });
  });

  it('inherits baseUrl and other options from the original client', async () => {
    const fetch = captureFetch({ allowed: true });
    const client = peretyn({ token: 'orig', fetch, baseUrl: 'https://custom.example.com' });
    const client2 = client.withToken('other');
    await client2.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.url.startsWith('https://custom.example.com/')).toBe(true);
  });

  it('does not mutate the original client token', async () => {
    const fetch = captureFetch({ allowed: true });
    const client = peretyn({ token: 'original', fetch });
    client.withToken('other');
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.init.headers).toMatchObject({ Authorization: 'Bearer original' });
  });
});

describe('options', () => {
  it('uses a custom baseUrl', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch, baseUrl: 'https://runtime.example.com' });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.url.startsWith('https://runtime.example.com/v1/')).toBe(true);
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch, baseUrl: 'https://runtime.example.com///' });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.url).toBe('https://runtime.example.com/v1/check');
  });

  it('throws at construction when token is empty', () => {
    expect(() => peretyn({ token: '', fetch: vi.fn() })).toThrow();
  });

  it('throws at construction when the token cannot be sent as a header', () => {
    expect(() => peretyn({ token: 'prn_live_…' })).toThrow(/token/);
  });

  it('sends token in Authorization header for all request types', async () => {
    const fetch = captureFetch();
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    const client = peretyn({ token: 'secret-token', fetch });
    await client.readChanges();
    expect(fetch.init.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });

  it('timeoutMs:0 disables the AbortController timeout', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: true }));
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0 });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it('aborts request after timeoutMs elapses', async () => {
    vi.useFakeTimers();
    try {
      let capturedSignal: AbortSignal | undefined;
      const fetch = vi.fn().mockImplementation((_url: unknown, init: RequestInit) => {
        capturedSignal = init.signal as AbortSignal;
        return new Promise(() => {});
      });
      const client = peretyn({ token: 'tok', fetch, timeoutMs: 100, retries: 0 });
      const checkPromise = client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      });
      checkPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(100);
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
