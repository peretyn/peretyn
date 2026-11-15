import { beforeAll, describe, expect, inject, it } from 'vitest';
import { type PeretynClient, PeretynError } from '@peretyn/sdk';
import { connectClient } from './client.js';
import { provisionEnvironmentWithoutSchema } from './runtime-admin.js';

const runtimeUrl = inject('runtimeUrl');
const runtimeInternalUrl = inject('runtimeInternalUrl');
const token = inject('token');

const alice = { type: 'user', id: 'alice-errors' };
const roadmap = { type: 'document', id: 'roadmap-errors' };

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to fail');
    },
    (error: unknown) => error,
  );
}

describe('errors name the mistake and the fix', () => {
  it('when a tuple is written to a permission', async () => {
    const error = await rejection(
      client.write({ writes: [{ subject: alice, relation: 'can_read', object: roadmap }] }),
    );
    expect(error).toBeInstanceOf(PeretynError);
    expect((error as PeretynError).message).toBe(
      `"can_read" is a permission of "document", so tuples can't be written to it. Write the tuple to a relation that "can_read" is computed from.`,
    );
  });

  it('when the environment has no schema yet', async () => {
    const emptyToken = await provisionEnvironmentWithoutSchema({
      internalUrl: runtimeInternalUrl,
      environmentName: 'errors-no-schema',
    });
    const emptyClient = connectClient({ token: emptyToken, baseUrl: runtimeUrl });
    const error = await rejection(
      emptyClient.write({ writes: [{ subject: alice, relation: 'viewer', object: roadmap }] }),
    );
    expect(error).toBeInstanceOf(PeretynError);
    expect((error as PeretynError).message).toBe(
      'this environment has no published schema yet. Publish one with "peretyn apply", then retry.',
    );
  });

  it('when batchCheck is given an object instead of an array', async () => {
    const error = await rejection(
      client.batchCheck({
        checks: [{ subject: alice, relation: 'viewer', object: roadmap }],
      } as never),
    );
    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toBe(
      'peretyn: batchCheck() takes an array of checks, such as [{ subject, relation, object }]; got an object',
    );
  });
});

describe('check', () => {
  it('leaves out an empty resolution', async () => {
    const result = await client.check({ subject: alice, relation: 'viewer', object: roadmap });
    expect(result).toEqual({ allowed: false });
  });
});
