import { describe, it, expect, vi } from 'vitest';
import { peretyn, PeretynError } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('check — wire format', () => {
  it('posts to /v1/check with correct tuple_key for a plain subject', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
    });
    expect(fetch.url).toBe('http://localhost:8080/v1/check');
    expect(fetch.init.method).toBe('POST');
    expect(fetch.init.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(fetch.body).toMatchObject({
      tuple_key: { user: 'user:alice', relation: 'viewer', object: 'document:doc1' },
    });
  });

  it('encodes a userset subject with #relation', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'tenant', id: 't1', relation: 'admin' },
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
    });
    expect(fetch.body.tuple_key.user).toBe('tenant:t1#admin');
  });

  it('passes contextual_tuples when provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
      contextualTuples: [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'owner',
          object: { type: 'document', id: 'doc1' },
        },
      ],
    });
    expect(fetch.body.contextual_tuples).toMatchObject({
      tuple_keys: [{ user: 'user:alice', relation: 'owner', object: 'document:doc1' }],
    });
  });

  it('omits contextual_tuples when not provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(fetch.body.contextual_tuples).toBeUndefined();
  });

  it('forwards consistency', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
      consistency: 'HIGHER_CONSISTENCY',
    });
    expect(fetch.body.consistency).toBe('HIGHER_CONSISTENCY');
  });

  it('forwards authorizationModelId', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
      authorizationModelId: 'model-xyz',
    });
    expect((fetch.body as Record<string, unknown>).authorization_model_id).toBe('model-xyz');
  });
});

describe('check — response parsing', () => {
  it('returns allowed:true correctly', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: true, resolution: '1.0.0' }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(result.allowed).toBe(true);
    expect(result.resolution).toBe('1.0.0');
  });

  it('returns allowed:false correctly', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: false }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(result.allowed).toBe(false);
  });

  it('coerces absent allowed to false', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.check({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'document', id: 'd1' },
    });
    expect(result.allowed).toBe(false);
  });
});

describe('assert', () => {
  it('resolves when allowed:true', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: true }));
    const client = peretyn({ token: 'tok', fetch });
    await expect(
      client.assert({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).resolves.toBeUndefined();
  });

  it('throws PeretynError with status 403 when allowed:false', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: false }));
    const client = peretyn({ token: 'tok', fetch });
    await expect(
      client.assert({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toThrow(PeretynError);
  });

  it('throws 403 PeretynError mentioning subject, relation, and object', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ allowed: false }));
    const client = peretyn({ token: 'tok', fetch });
    let thrown: PeretynError | undefined;
    try {
      await client.assert({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      });
    } catch (e) {
      thrown = e as PeretynError;
    }
    expect(thrown?.status).toBe(403);
    expect(thrown?.message).toContain('user:alice');
    expect(thrown?.message).toContain('viewer');
    expect(thrown?.message).toContain('document:d1');
  });
});

describe('PeretynError', () => {
  it('sets status and body from a failed response', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'unauthorized' }, 401));
    const client = peretyn({ token: 'tok', fetch });
    let thrown: PeretynError | undefined;
    try {
      await client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      });
    } catch (e) {
      thrown = e as PeretynError;
    }
    expect(thrown).toBeInstanceOf(PeretynError);
    expect(thrown?.status).toBe(401);
    expect(thrown?.body).toMatchObject({ error: 'unauthorized' });
  });

  it('uses response body "error" field as the error message', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ error: 'store not found' }, 404));
    const client = peretyn({ token: 'tok', fetch });
    await expect(
      client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toThrow('store not found');
  });

  it('keeps non-JSON response body as string', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('gateway timeout', {
        status: 504,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const client = peretyn({ token: 'tok', fetch });
    let thrown: PeretynError | undefined;
    try {
      await client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      });
    } catch (e) {
      thrown = e as PeretynError;
    }
    expect(thrown?.body).toBe('gateway timeout');
  });

  it('falls back to generic message when body has no error field', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ code: 500 }, 500));
    const client = peretyn({ token: 'tok', fetch, retries: 0 });
    await expect(
      client.check({
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'document', id: 'd1' },
      }),
    ).rejects.toThrow('Peretyn runtime returned 500');
  });
});
