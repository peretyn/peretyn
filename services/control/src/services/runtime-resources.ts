import { Result } from '@praha/byethrow';
import { runtimeClient } from '../lib/runtime-client.js';
import { RuntimeError } from '../lib/errors/runtime.error.js';
import { logError } from '../lib/log.js';

export type RuntimeResources = { externalUuid: string; openfgaStoreId?: string };

async function settle(
  ids: string[],
  action: (id: string) => Promise<unknown>,
  msg: string,
): Promise<Error[]> {
  const outcomes = await Promise.allSettled(ids.map(action));
  return outcomes.flatMap((outcome, i) => {
    if (outcome.status === 'fulfilled') return [];
    const error = outcome.reason as Error;
    logError(msg, { id: ids[i], error });
    return [error];
  });
}

export async function revokeKeys(
  environments: RuntimeResources[],
): Result.ResultAsync<void, RuntimeError> {
  const runtime = runtimeClient();
  const [error] = await settle(
    environments.map((env) => env.externalUuid),
    (uuid) => runtime.deleteKey(uuid),
    'runtime key revocation failed',
  );
  return error
    ? Result.fail(new RuntimeError({ operation: 'deleteKey', error }))
    : Result.succeed();
}

export async function deleteStores(environments: RuntimeResources[]): Promise<void> {
  const runtime = runtimeClient();
  await settle(
    environments.flatMap((env) => (env.openfgaStoreId ? [env.openfgaStoreId] : [])),
    (storeId) => runtime.deleteStore(storeId),
    'runtime store deletion failed (continuing)',
  );
}

export async function releaseRuntimeResources(
  environments: RuntimeResources[],
): Result.ResultAsync<void, RuntimeError> {
  const revoked = await revokeKeys(environments);
  if (Result.isSuccess(revoked)) await deleteStores(environments);
  return revoked;
}

export async function discardCreatedResources(environments: RuntimeResources[]): Promise<void> {
  await revokeKeys(environments);
  await deleteStores(environments);
}
