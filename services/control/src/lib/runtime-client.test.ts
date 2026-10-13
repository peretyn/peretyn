import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runtimeClient } from './runtime-client.js';

let fetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('PERETYN_INTERNAL_SECRET', 'test-secret');
  vi.stubEnv('PERETYN_RUNTIME_INTERNAL_URL', undefined);
  vi.stubEnv('PERETYN_RUNTIME_URL', 'http://public-runtime:8080');
  fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("defaults to the runtime's internal listener, not the SDK's public URL", async () => {
  await runtimeClient().deleteKey('env-uuid');
  expect(fetch.mock.calls[0]![0]).toBe('http://localhost:8081/v1/internal/keys/env-uuid');
});

it('dials PERETYN_RUNTIME_INTERNAL_URL', async () => {
  vi.stubEnv('PERETYN_RUNTIME_INTERNAL_URL', 'http://runtime:8081/');
  await runtimeClient().deleteKey('env-uuid');
  expect(fetch.mock.calls[0]![0]).toBe('http://runtime:8081/v1/internal/keys/env-uuid');
});
