import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('write', () => {
  describe('when writing multiple tuples', () => {
    it('returns the correct written and deleted counts', async () => {
      const result = await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'write-count-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-write-count' },
          },
          {
            subject: { type: 'user', id: 'write-count-user' },
            relation: 'editor',
            object: { type: 'document', id: 'doc-write-count' },
          },
        ],
      });
      expect(result.written).toBe(2);
      expect(result.deleted).toBe(0);
    });
  });

  describe('when writing a tuple that already exists', () => {
    it('absorbs the duplicate without error (onDuplicate:ignore default)', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'dup-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-dup' },
          },
        ],
      });
      await expect(
        client.write({
          writes: [
            {
              subject: { type: 'user', id: 'dup-user' },
              relation: 'viewer',
              object: { type: 'document', id: 'doc-dup' },
            },
          ],
        }),
      ).resolves.toBeDefined();
    });
  });
});
