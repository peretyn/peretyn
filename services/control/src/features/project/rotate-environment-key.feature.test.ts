import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import { rotateEnvironmentKey } from './rotate-environment-key.feature.js';
import * as runtime from '../../lib/runtime-client.js';
import * as environmentRepository from '../../repositories/environment.repository.js';
import * as apiTokenRepository from '../../repositories/api-token.repository.js';
import { ConflictError } from '../../errors/conflict.error.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { DatabaseError } from '../../db/database.error.js';

const projectId = randomUUID();
const envId = randomUUID();
const rotated = { plaintext: 'prn_dev_new_key', prefix: 'prn_dev_', last4: '_key' };

function givenEnvironment(openfgaStoreId?: string) {
  vi.spyOn(environmentRepository, 'getEnvironmentByIdAndProjectId').mockResolvedValue(
    Result.succeed({
      id: envId,
      name: 'development',
      projectId,
      externalUuid: randomUUID(),
      openfgaStoreId,
      status: openfgaStoreId ? 'active' : 'pending',
      isProduction: false,
      createdAt: new Date(),
    }),
  );
}

function givenRuntime(rotateKey: () => Promise<typeof rotated>) {
  vi.spyOn(runtime, 'runtimeClient').mockReturnValue({ rotateKey } as unknown as ReturnType<
    typeof runtime.runtimeClient
  >);
}

describe('rotateEnvironmentKey', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports a pending environment as a conflict', async () => {
    givenEnvironment(undefined);
    const result = await rotateEnvironmentKey({ projectId, envId });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('reports a runtime failure as a RuntimeError', async () => {
    givenEnvironment('store_1');
    givenRuntime(() => Promise.reject(new TypeError('fetch failed')));
    const result = await rotateEnvironmentKey({ projectId, envId });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(RuntimeError);
  });

  it('still returns the new key when the metadata update fails, because the old key is gone', async () => {
    givenEnvironment('store_1');
    givenRuntime(() => Promise.resolve(rotated));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(apiTokenRepository, 'updateApiTokenRotation').mockResolvedValue(
      Result.fail(new DatabaseError({ entity: 'apiTokenMetadata', operation: 'write' })),
    );
    const result = await rotateEnvironmentKey({ projectId, envId });
    assert(Result.isSuccess(result));
    expect(result.value).toEqual(rotated);
    expect(logged).toHaveBeenCalled();
  });
});
