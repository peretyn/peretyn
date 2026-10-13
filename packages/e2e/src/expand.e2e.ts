import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('expand', () => {
  describe('when a tuple exists for the relation', () => {
    it('returns a proof tree', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'expand-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-expand' },
          },
        ],
      });
      const result = await client.expand({
        relation: 'viewer',
        object: { type: 'document', id: 'doc-expand' },
      });
      expect(result.tree).toBeDefined();
    });
  });

  describe('when no tuples exist for the relation', () => {
    it('returns a tree property without error', async () => {
      const result = await client.expand({
        relation: 'viewer',
        object: { type: 'document', id: 'doc-expand-empty' },
      });
      expect(result).toHaveProperty('tree');
    });
  });
});
