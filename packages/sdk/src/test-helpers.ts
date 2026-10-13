import { vi } from 'vitest';

export function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type CapturedTupleChanges = {
  readonly tuple_keys: unknown;
  readonly on_duplicate: string;
  readonly on_missing: string;
};

type CapturedBatchCheck = {
  readonly consistency: string;
};

type CapturedBody = {
  readonly authorization_model_id: string;
  readonly consistency: string;
  readonly contextual_tuples: unknown;
  readonly tuple_key: { readonly user: string };
  readonly checks: readonly [CapturedBatchCheck, ...CapturedBatchCheck[]];
  readonly writes: CapturedTupleChanges;
  readonly deletes: CapturedTupleChanges;
};

type FetchCall = [unknown, RequestInit?] | undefined;

function readableGetter(read: () => unknown): PropertyDescriptor {
  return { get: read, enumerable: true, configurable: true };
}

function parseJsonBody(call: FetchCall): unknown {
  const body = call?.[1]?.body;
  return body != null ? JSON.parse(body as string) : undefined;
}

export function captureFetch(defaultBody: unknown = {}) {
  const fn = vi.fn().mockImplementation(() => Promise.resolve(mockResponse(defaultBody)));
  const lastCall = () => fn.mock.calls[fn.mock.calls.length - 1] as FetchCall;
  Object.defineProperties(fn, {
    url: readableGetter(() => String(lastCall()?.[0] ?? '')),
    init: readableGetter(() => lastCall()?.[1] ?? {}),
    body: readableGetter(() => parseJsonBody(lastCall())),
  });
  return fn as typeof fn & {
    readonly url: string;
    readonly init: RequestInit;
    readonly body: CapturedBody;
  };
}
