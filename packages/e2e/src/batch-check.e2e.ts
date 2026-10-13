import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('batchCheck', () => {
  describe('when checks contain a mix of written and unwritten tuples', () => {
    it('returns correct allowed values for each in one round-trip', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'batch-alice' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-batch-1' },
          },
        ],
      });
      const results = await client.batchCheck([
        {
          subject: { type: 'user', id: 'batch-alice' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc-batch-1' },
        },
        {
          subject: { type: 'user', id: 'batch-alice' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc-batch-2' }, // not written
        },
      ]);
      expect(results[0]?.allowed).toBe(true);
      expect(results[1]?.allowed).toBe(false);
    });
  });

  describe('when given more checks than one OpenFGA batch allows', () => {
    it('returns every result in input order', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => `doc-batch-many-${i}`);
      const granted = new Set([0, 49, 50, 99, 100, 119]);
      await client.write({
        writes: [...granted].map((i) => ({
          subject: { type: 'user', id: 'batch-many' },
          relation: 'viewer',
          object: { type: 'document', id: `doc-batch-many-${i}` },
        })),
      });
      const results = await client.batchCheck(
        ids.map((id) => ({
          subject: { type: 'user', id: 'batch-many' },
          relation: 'viewer',
          object: { type: 'document', id },
        })),
      );
      expect(results.map((r) => r.allowed)).toEqual(ids.map((_, i) => granted.has(i)));
    });
  });

  describe('when results are split across several OpenFGA batches', () => {
    it('pairs every result with the exact check it answers', async () => {
      const checks = Array.from({ length: 120 }, (_, i) => ({
        subject: { type: 'user', id: 'batch-echo' },
        relation: 'viewer',
        object: { type: 'document', id: `doc-batch-echo-${i}` },
      }));
      const results = await client.batchCheck(checks);
      expect(results.map((r) => r.check)).toEqual(checks);
      results.forEach((result, i) => expect(result.check).toBe(checks[i]));
    });
  });

  describe('when one batch checks the same object for several relations', () => {
    it('tells the results apart by their check', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'batch-echo-editor' },
            relation: 'editor',
            object: { type: 'document', id: 'doc-batch-echo-shared' },
          },
        ],
      });
      const object = { type: 'document', id: 'doc-batch-echo-shared' };
      const subject = { type: 'user', id: 'batch-echo-editor' };
      const results = await client.batchCheck([
        { subject, relation: 'editor', object },
        { subject, relation: 'viewer', object },
      ]);
      expect(results.map((r) => [r.check.relation, r.allowed])).toEqual([
        ['editor', true],
        ['viewer', false],
      ]);
    });
  });

  describe('when given an empty array', () => {
    it('returns [] without calling the runtime', async () => {
      const results = await client.batchCheck([]);
      expect(results).toEqual([]);
    });
  });
});
