import { describe, it, expect, beforeAll, inject } from 'vitest';
import { type PeretynClient, PeretynError } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('check', () => {
  describe('when no tuple has been written', () => {
    it('returns allowed:false', async () => {
      const result = await client.check({
        subject: { type: 'user', id: 'nobody' },
        relation: 'viewer',
        object: { type: 'document', id: 'nonexistent' },
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('when a viewer tuple exists', () => {
    it('returns allowed:true for the direct relation', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'alice-check' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-check' },
          },
        ],
      });
      const result = await client.check({
        subject: { type: 'user', id: 'alice-check' },
        relation: 'viewer',
        object: { type: 'document', id: 'doc-check' },
      });
      expect(result.allowed).toBe(true);
    });

    it('returns allowed:true for can_read via computed union', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'viewer-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-union' },
          },
        ],
      });
      const result = await client.check({
        subject: { type: 'user', id: 'viewer-user' },
        relation: 'can_read',
        object: { type: 'document', id: 'doc-union' },
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('when an editor tuple exists', () => {
    it('returns allowed:true for can_read via computed union', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'editor-user' },
            relation: 'editor',
            object: { type: 'document', id: 'doc-editor-union' },
          },
        ],
      });
      const result = await client.check({
        subject: { type: 'user', id: 'editor-user' },
        relation: 'can_read',
        object: { type: 'document', id: 'doc-editor-union' },
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('after a tuple is deleted', () => {
    it('returns allowed:false', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'delete-test-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-delete' },
          },
        ],
      });
      await client.write({
        deletes: [
          {
            subject: { type: 'user', id: 'delete-test-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-delete' },
          },
        ],
      });
      const result = await client.check({
        subject: { type: 'user', id: 'delete-test-user' },
        relation: 'viewer',
        object: { type: 'document', id: 'doc-delete' },
      });
      expect(result.allowed).toBe(false);
    });
  });
});

describe('assert', () => {
  describe('when the tuple exists', () => {
    it('resolves without error', async () => {
      await client.write({
        writes: [
          {
            subject: { type: 'user', id: 'assert-user' },
            relation: 'viewer',
            object: { type: 'document', id: 'doc-assert' },
          },
        ],
      });
      await expect(
        client.assert({
          subject: { type: 'user', id: 'assert-user' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc-assert' },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('when access is denied', () => {
    it('throws PeretynError with status 403', async () => {
      const err = await client
        .assert({
          subject: { type: 'user', id: 'assert-denied-user' },
          relation: 'viewer',
          object: { type: 'document', id: 'doc-assert-denied' },
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(PeretynError);
      expect((err as PeretynError).status).toBe(403);
    });
  });
});
