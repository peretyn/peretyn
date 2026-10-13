import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('lookupResources', () => {
  describe('when the subject has access to multiple resources', () => {
    it('returns all matching resource ids stripped of type prefix', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'lookup-res-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'lookup-res-doc1' },
          },
          {
            subject: { type: 'user', id: 'lookup-res-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'lookup-res-doc2' },
          },
        ],
      });
      const result = await client.lookupResources({
        subject: { type: 'user', id: 'lookup-res-user' },
        relation: 'viewer',
        resourceType: 'document',
      });
      expect(result.ids).toContain('lookup-res-doc1');
      expect(result.ids).toContain('lookup-res-doc2');
      expect(result.ids.every((id) => !id.startsWith('document:'))).toBe(true);
    });
  });

  describe('when the subject has no access', () => {
    it('returns empty ids', async () => {
      const result = await client.lookupResources({
        subject: { type: 'user', id: 'lookup-res-nobody' },
        relation: 'viewer',
        resourceType: 'document',
      });
      expect(result.ids).toEqual([]);
    });
  });
});
