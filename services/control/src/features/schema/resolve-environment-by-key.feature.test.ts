import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import { resolveEnvironmentByKey } from './resolve-environment-by-key.feature.js';
import * as runtime from '../../lib/runtime-client.js';
import * as environmentRepository from '../../repositories/environment.repository.js';
import { ForbiddenError } from '../../errors/forbidden.error.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';

const fakeEnv = (openfgaStoreId: string) => ({
  id: randomUUID(),
  name: 'development',
  projectId: randomUUID(),
  externalUuid: randomUUID(),
  openfgaStoreId,
  status: 'active',
  isProduction: false,
  createdAt: new Date(),
});

describe('resolveEnvironmentByKey', () => {
  afterEach(() => vi.clearAllMocks());

  it('resolves the env when the runtime validates the key', async () => {
    const storeId = randomUUID();
    const env = fakeEnv(storeId);
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      resolveKey: () =>
        Promise.resolve({ storeId, environment: 'development', projectSlug: 'docs', kind: 'env' }),
    } as unknown as ReturnType<typeof runtime.runtimeClient>);
    vi.spyOn(environmentRepository, 'getEnvironmentByStoreId').mockResolvedValue(
      Result.succeed(env),
    );

    const result = await resolveEnvironmentByKey('prn_env_good');

    assert(Result.isSuccess(result));
    expect(result.value.id).toBe(env.id);
  });

  it.each([401, 403])('forbids when the runtime rejects the key with %i', async (status) => {
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      resolveKey: () => Promise.reject(new runtime.RuntimeResponseError(status, 'unknown token')),
    } as unknown as ReturnType<typeof runtime.runtimeClient>);

    const result = await resolveEnvironmentByKey('prn_env_bad');

    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it.each([
    ['a 503', new runtime.RuntimeResponseError(503, 'keys.lookup failed')],
    ['a timeout', new DOMException('The operation was aborted due to timeout', 'TimeoutError')],
    ['a network failure', new TypeError('fetch failed')],
  ])('reports %s as a runtime failure, not a bad key', async (_, error) => {
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      resolveKey: () => Promise.reject(error),
    } as unknown as ReturnType<typeof runtime.runtimeClient>);

    const result = await resolveEnvironmentByKey('prn_env_good');

    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(RuntimeError);
  });
});
