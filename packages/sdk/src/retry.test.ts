import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { peretyn, PeretynError, PeretynTimeoutError, PeretynUnavailableError } from './index.js';
import { mockResponse } from './test-helpers.js';

const tuple = {
  subject: { type: 'user', id: 'alice' },
  relation: 'owner',
  object: { type: 'document', id: 'd1' },
};

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on 5xx up to maxRetries times then throws', async () => {
    const fetch = vi.fn().mockImplementation(async () => mockResponse({ error: 'oops' }, 503));
    const client = peretyn({ token: 'tok', fetch, retries: 2, retryBackoffMs: 10 });
    const checkPromise = client
      .check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const result = await checkPromise;
    expect(result).toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries on 429', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({}, 429))
      .mockResolvedValueOnce(mockResponse({ allowed: true }));
    const client = peretyn({ token: 'tok', fetch, retries: 1, retryBackoffMs: 10 });
    const checkPromise = client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    await vi.runAllTimersAsync();
    const result = await checkPromise;
    expect(result.allowed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 504 — the runtime already spent its deadline', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'deadline' }, 504));
    const client = peretyn({ token: 'tok', fetch, retries: 2, retryBackoffMs: 10 });
    await expect(
      client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once the budget cannot fit another attempt', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'oops' }, 503));
    const client = peretyn({
      token: 'tok',
      fetch,
      retries: 5,
      retryBackoffMs: 1_000,
      timeoutMs: 100,
    });
    const checkPromise = client
      .check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await checkPromise).toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws PeretynTimeoutError, not a raw AbortError, when the budget runs out', async () => {
    const fetch = vi.fn().mockImplementation(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 200, retries: 2 });
    const checkPromise = client
      .check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await checkPromise;
    expect(err).toBeInstanceOf(PeretynTimeoutError);
    expect((err as PeretynTimeoutError).timeoutMs).toBe(200);
    expect((err as Error).message).toContain('200ms');
  });

  it('does NOT retry on 4xx errors (except 429)', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'not found' }, 404));
    const client = peretyn({ token: 'tok', fetch, retries: 2 });
    await expect(
      client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After header in seconds', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { 'Retry-After': '2', 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(mockResponse({ allowed: true }));
    const client = peretyn({
      token: 'tok',
      fetch,
      retries: 1,
      retryBackoffMs: 1,
      timeoutMs: 10_000,
    });
    const checkPromise = client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await checkPromise;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on network errors', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(mockResponse({ allowed: true }));
    const client = peretyn({ token: 'tok', fetch, retries: 1, retryBackoffMs: 10 });
    const checkPromise = client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    await vi.runAllTimersAsync();
    const result = await checkPromise;
    expect(result.allowed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cancels the body of a response it discards for a retry', async () => {
    const cancel = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 503 }))
      .mockResolvedValueOnce(mockResponse({ allowed: true }));
    const client = peretyn({ token: 'tok', fetch, retries: 1, retryBackoffMs: 10 });
    const checkPromise = client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    await vi.runAllTimersAsync();
    await checkPromise;
    expect(cancel).toHaveBeenCalled();
  });

  it('retries an idempotent write after a lost response', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch, retries: 1, retryBackoffMs: 10 });
    const writePromise = client.write({ writes: [tuple], deletes: [tuple] });
    await vi.runAllTimersAsync();
    await writePromise;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { strict: true },
    { onDuplicate: 'error' as const },
    { onDuplicate: 'ignore' as const, onMissing: 'error' as const },
  ])('does NOT retry a non-idempotent write (%j)', async (idempotency) => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = peretyn({ token: 'tok', fetch, retries: 2, retryBackoffMs: 10 });
    const writePromise = client
      .write({ ...idempotency, writes: [tuple], deletes: [tuple] })
      .catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await writePromise).toBeInstanceOf(PeretynUnavailableError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a non-idempotent write on 5xx', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'oops' }, 503));
    const client = peretyn({ token: 'tok', fetch, retries: 2, retryBackoffMs: 10 });
    const writePromise = client.write({ strict: true, writes: [tuple] }).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await writePromise).toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries:0 disables retry and throws on first failure', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}, 503));
    const client = peretyn({ token: 'tok', fetch, retries: 0 });
    await expect(
      client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toBeInstanceOf(PeretynError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
