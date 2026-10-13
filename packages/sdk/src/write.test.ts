import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('write — wire format', () => {
  it('builds writes.tuple_keys from the writes array', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(fetch.body.writes.tuple_keys).toEqual([
      { user: 'user:alice', relation: 'owner', object: 'doc:1' },
    ]);
  });

  it('builds deletes.tuple_keys from the deletes array', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      deletes: [
        {
          subject: { type: 'user', id: 'bob' },
          relation: 'editor',
          object: { type: 'doc', id: '2' },
        },
      ],
    });
    expect(fetch.body.deletes.tuple_keys).toEqual([
      { user: 'user:bob', relation: 'editor', object: 'doc:2' },
    ]);
  });

  it('defaults on_duplicate to "ignore"', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(fetch.body.writes.on_duplicate).toBe('ignore');
  });

  it('defaults on_missing to "ignore"', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      deletes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(fetch.body.deletes.on_missing).toBe('ignore');
  });

  it('strict:true sets both on_duplicate and on_missing to "error"', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      strict: true,
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
      deletes: [
        {
          subject: { type: 'user', id: 'bob' },
          relation: 'editor',
          object: { type: 'doc', id: '2' },
        },
      ],
    });
    expect(fetch.body.writes.on_duplicate).toBe('error');
    expect(fetch.body.deletes.on_missing).toBe('error');
  });

  it('omits writes key when writes array is empty or absent', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      deletes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(fetch.body.writes).toBeUndefined();
  });

  it('omits deletes key when deletes array is empty or absent', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(fetch.body.deletes).toBeUndefined();
  });

  it('forwards authorizationModelId', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.write({
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
      authorizationModelId: 'model-123',
    });
    expect(fetch.body.authorization_model_id).toBe('model-123');
  });

  it('throws when both writes and deletes are empty', async () => {
    const fetch = vi.fn();
    const client = peretyn({ token: 'tok', fetch });
    // @ts-expect-error the runtime guard covers untyped callers
    await expect(client.write({})).rejects.toThrow('write() called with no writes or deletes.');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('write — response parsing', () => {
  it('returns written count equal to writes array length', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.write({
      writes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
        {
          subject: { type: 'user', id: 'bob' },
          relation: 'editor',
          object: { type: 'doc', id: '2' },
        },
      ],
    });
    expect(result.written).toBe(2);
    expect(result.deleted).toBe(0);
  });

  it('returns deleted count equal to deletes array length', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.write({
      deletes: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'doc', id: '1' },
        },
      ],
    });
    expect(result.written).toBe(0);
    expect(result.deleted).toBe(1);
  });
});
