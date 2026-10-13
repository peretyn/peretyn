import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';
import * as runtime from '../lib/runtime-client.js';
import { releaseRuntimeResources } from './runtime-resources.js';

const environments = [
  { externalUuid: 'env-1', openfgaStoreId: 'store-1' },
  { externalUuid: 'env-2', openfgaStoreId: 'store-2' },
];

describe('releaseRuntimeResources', () => {
  let deleteKey: ReturnType<typeof vi.fn>;
  let deleteStore: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deleteKey = vi.fn().mockResolvedValue(null);
    deleteStore = vi.fn().mockResolvedValue(null);
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      deleteKey,
      deleteStore,
    } as unknown as ReturnType<typeof runtime.runtimeClient>);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps every store when a key cannot be revoked', async () => {
    deleteKey.mockRejectedValueOnce(new TypeError('fetch failed'));
    const result = await releaseRuntimeResources(environments);
    assert(Result.isFailure(result));
    expect(deleteStore).not.toHaveBeenCalled();
  });

  it('deletes the stores once every key is revoked', async () => {
    const result = await releaseRuntimeResources(environments);
    assert(Result.isSuccess(result));
    expect(deleteStore).toHaveBeenCalledTimes(2);
  });
});
