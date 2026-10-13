import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('lookupSubjects', () => {
  describe('when multiple subjects have access via different relations', () => {
    it('returns subjects with the queried relation', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'lookup-sub-alice' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-lookup-sub' },
          },
          {
            subject: { type: 'user', id: 'lookup-sub-bob' },
            relation: 'editor',
            object: { type: 'document', id: 'doc-lookup-sub' },
          },
        ],
      });
      const viewers = await client.lookupSubjects({
        resource: { type: 'document', id: 'doc-lookup-sub' },
        relation: 'viewer',
        subjectType: 'user',
      });
      expect(viewers.subjects).toContain('user:lookup-sub-alice');
    });
  });

  describe('when no subjects match', () => {
    it('returns empty subjects', async () => {
      const result = await client.lookupSubjects({
        resource: { type: 'document', id: 'doc-lookup-sub-empty' },
        relation: 'viewer',
        subjectType: 'user',
      });
      expect(result.subjects).toEqual([]);
    });
  });
});
