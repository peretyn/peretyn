import { describe, expect, it } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

const subject = { type: 'user', id: 'alice' };
const object = { type: 'doc', id: '1' };

function untypedClient() {
  const fetch = captureFetch();
  return { client: peretyn({ token: 'tok', fetch }), fetch };
}

describe('argument validation', () => {
  it.each([
    {
      name: 'batchCheck given an object instead of an array',
      call: (client: ReturnType<typeof peretyn>) =>
        client.batchCheck({ checks: [{ subject, relation: 'viewer', object }] } as never),
      message:
        'peretyn: batchCheck() takes an array of checks, such as [{ subject, relation, object }]; got an object',
    },
    {
      name: 'batchCheck given a check without an object',
      call: (client: ReturnType<typeof peretyn>) =>
        client.batchCheck([{ subject, relation: 'viewer' }] as never),
      message:
        'peretyn: batchCheck() check 0 is missing "object"; each check needs subject, relation and object',
    },
    {
      name: 'check without a relation',
      call: (client: ReturnType<typeof peretyn>) => client.check({ subject, object } as never),
      message: 'peretyn: check() is missing "relation"; it needs subject, relation and object',
    },
    {
      name: 'assert without a subject',
      call: (client: ReturnType<typeof peretyn>) =>
        client.assert({ relation: 'viewer', object } as never),
      message: 'peretyn: assert() is missing "subject"; it needs subject, relation and object',
    },
    {
      name: 'write given a single tuple instead of an array',
      call: (client: ReturnType<typeof peretyn>) =>
        client.write({ writes: { subject, relation: 'viewer', object } } as never),
      message:
        'peretyn: write() "writes" must be an array of tuples, such as [{ subject, relation, object }]',
    },
  ])('rejects $name before calling the runtime', async ({ call, message }) => {
    const { client, fetch } = untypedClient();
    await expect(call(client)).rejects.toThrow(new TypeError(message));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('check resolution', () => {
  it('is left out when the runtime returns it empty', async () => {
    const { client, fetch } = untypedClient();
    fetch.mockResolvedValueOnce(mockResponse({ allowed: true, resolution: '' }));
    await expect(client.check({ subject, relation: 'viewer', object })).resolves.toEqual({
      allowed: true,
    });
  });
});
