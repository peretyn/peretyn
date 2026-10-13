import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('readChanges', () => {
  describe('after writing a tuple', () => {
    it('reflects the write in the change log', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'changes-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-changes' },
          },
        ],
      });
      const result = await client.readChanges();
      expect(result.changes.length).toBeGreaterThan(0);
      const writeOp = result.changes.find(
        (c) =>
          c.operation === 'TUPLE_OPERATION_WRITE' && c.tuple_key?.object === 'document:doc-changes',
      );
      expect(writeOp).toBeDefined();
    });
  });

  describe('when filtering by object type', () => {
    it('returns only changes for that type', async () => {
      const result = await client.readChanges({ type: 'document' });
      expect(result.changes.every((c) => c.tuple_key?.object?.startsWith('document:'))).toBe(true);
    });
  });

  describe('when paginating via continuationToken', () => {
    it('returns a valid second page without error', async () => {
      const first = await client.readChanges();
      if (first.continuationToken) {
        const second = await client.readChanges({ continuationToken: first.continuationToken });
        expect(Array.isArray(second.changes)).toBe(true);
      }
    });
  });
});
