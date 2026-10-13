import { describe, it, expect, beforeAll, inject } from 'vitest';
import { type PeretynClient, PeretynError } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('withToken', () => {
  describe('when the token is not in the runtime registry', () => {
    it('throws PeretynError', async () => {
      const otherClient = client.withToken('unknown-token');
      await expect(
        otherClient.check({
          subject: { type: 'user', id: 'user1' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc1' },
        }),
      ).rejects.toBeInstanceOf(PeretynError);
    });
  });
});

describe('error handling', () => {
  describe('when the token is unknown', () => {
    it('throws PeretynError with status 401', async () => {
      const badClient = connectClient({ token: 'bad-token', baseUrl: runtimeUrl });
      const err = await badClient
        .check({
          subject: { type: 'user', id: 'user1' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc1' },
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(PeretynError);
      expect((err as PeretynError).status).toBe(401);
    });
  });
});
