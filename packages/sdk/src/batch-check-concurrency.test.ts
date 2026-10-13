import { describe, it, expect, vi } from 'vitest';
import { peretyn, PeretynError, PeretynTimeoutError } from './index.js';
import { mockResponse } from './test-helpers.js';

const CHECKS_PER_BATCH = 50;
const MAX_BATCHES_IN_FLIGHT = 4;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVICE_UNAVAILABLE = 503;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

type WireCheck = { correlation_id: string; tuple_key: { object: string } };
type BatchReply = (batchIndex: number, attempt: number, signal: AbortSignal) => Promise<Response>;
type RuntimeReply = (
  checks: WireCheck[],
  batchIndex: number,
  signal: AbortSignal,
) => Promise<Response>;

function buildChecks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    subject: { type: 'user', id: 'u' },
    relation: 'viewer',
    object: { type: 'doc', id: String(i) },
  }));
}

function isGranted(objectId: number) {
  return objectId % 3 === 0;
}

function answerChecks(checks: WireCheck[]) {
  const entries = checks.map((check) => {
    const objectId = Number(check.tuple_key.object.split(':')[1]);
    return [check.correlation_id, { allowed: isGranted(objectId) }];
  });
  return mockResponse({ result: Object.fromEntries(entries) });
}

function fakeRuntime(reply: RuntimeReply) {
  const stats = { inFlight: 0, maxInFlight: 0, requests: 0, signals: [] as AbortSignal[] };
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const checks = (JSON.parse(init?.body as string) as { checks: WireCheck[] }).checks;
    const batchIndex = Number(checks[0]?.correlation_id.slice(1)) / CHECKS_PER_BATCH;
    stats.requests++;
    const signal = init?.signal as AbortSignal;
    stats.signals[batchIndex] = signal;
    stats.inFlight++;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    try {
      return await reply(checks, batchIndex, signal);
    } finally {
      stats.inFlight--;
    }
  });
  return { fetch, stats };
}

function slowAnswer(delayMs: number): RuntimeReply {
  return async (checks, _batchIndex, signal) => {
    await sleep(delayMs, signal);
    return answerChecks(checks);
  };
}

function runtimeWithReplies(replies: BatchReply) {
  const attempts = new Map<number, number>();
  return fakeRuntime((_checks, batchIndex, signal) => {
    const attempt = attempts.get(batchIndex) ?? 0;
    attempts.set(batchIndex, attempt + 1);
    return replies(batchIndex, attempt, signal);
  });
}

describe('batchCheck — concurrency', () => {
  it(`never has more than ${MAX_BATCHES_IN_FLIGHT} batches in flight for 10k checks`, async () => {
    const { fetch, stats } = fakeRuntime(slowAnswer(1));
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0 });
    await client.batchCheck(buildChecks(10_000));
    expect(stats.requests).toBe(200);
    expect(stats.maxInFlight).toBe(MAX_BATCHES_IN_FLIGHT);
  });

  it('returns results in input order when batches finish out of order', async () => {
    const { fetch } = fakeRuntime(async (checks, batchIndex, signal) => {
      await sleep((batchIndex % 4) * 5, signal);
      return answerChecks(checks);
    });
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0 });
    const checks = buildChecks(1_000);
    const results = await client.batchCheck(checks);
    expect(results.map((r) => r.allowed)).toEqual(checks.map((_, i) => isGranted(i)));
    results.forEach((result, i) => expect(result.check).toBe(checks[i]));
  });

  it('sends no request for an empty input', async () => {
    const { fetch } = fakeRuntime(slowAnswer(1));
    const client = peretyn({ token: 'tok', fetch });
    await expect(client.batchCheck([])).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('batchCheck — one deadline for the whole call', () => {
  it('rejects with PeretynTimeoutError within timeoutMs when batches queue behind the cap', async () => {
    const timeoutMs = 250;
    const { fetch } = fakeRuntime(slowAnswer(100));
    const client = peretyn({ token: 'tok', fetch, timeoutMs, retries: 0 });
    const startedAt = performance.now();
    const err = await client.batchCheck(buildChecks(600)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PeretynTimeoutError);
    expect(performance.now() - startedAt).toBeLessThan(timeoutMs + 50);
  });
});

describe('batchCheck — first failure', () => {
  function failSecondBatch() {
    return runtimeWithReplies(async (batchIndex, _attempt, signal) => {
      if (batchIndex === 1) return mockResponse({ message: 'bad batch' }, HTTP_BAD_REQUEST);
      await sleep(50, signal);
      return mockResponse({ result: {} });
    });
  }

  it('rejects with the failing batch error, not an abort from its siblings', async () => {
    const { fetch } = failSecondBatch();
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0 });
    const err = await client.batchCheck(buildChecks(10_000)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PeretynError);
    expect((err as PeretynError).status).toBe(HTTP_BAD_REQUEST);
  });

  it('starts no further batch and aborts the ones in flight', async () => {
    const { fetch, stats } = failSecondBatch();
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0 });
    await client.batchCheck(buildChecks(10_000)).catch(() => undefined);
    await sleep(100);
    expect(stats.requests).toBe(MAX_BATCHES_IN_FLIGHT);
    const siblings = stats.signals.filter((_, batchIndex) => batchIndex !== 1);
    expect(siblings.every((signal) => signal.aborted)).toBe(true);
  });

  it('does not retry a batch after the call has failed', async () => {
    const { fetch, stats } = runtimeWithReplies(async (batchIndex, _attempt, signal) => {
      if (batchIndex === 0) return mockResponse({}, HTTP_SERVICE_UNAVAILABLE);
      await sleep(10, signal);
      return mockResponse({ message: 'bad batch' }, HTTP_BAD_REQUEST);
    });
    const client = peretyn({ token: 'tok', fetch, timeoutMs: 0, retryBackoffMs: 50 });
    await client.batchCheck(buildChecks(100)).catch(() => undefined);
    await sleep(200);
    expect(stats.requests).toBe(2);
  });
});
