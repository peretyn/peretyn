import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('batchCheck — wire format', () => {
  it('posts to /v1/batch-check with correlation_id c0, c1 assigned', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(
      mockResponse({ result: { c0: { allowed: true }, c1: { allowed: false } } }),
    );
    await client.batchCheck([
      {
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'doc', id: '1' },
      },
      {
        subject: { type: 'user', id: 'bob' },
        relation: 'editor',
        object: { type: 'doc', id: '2' },
      },
    ]);
    expect(fetch.url).toBe('http://localhost:8080/v1/batch-check');
    expect(fetch.body.checks).toMatchObject([
      { correlation_id: 'c0', tuple_key: { user: 'user:alice' } },
      { correlation_id: 'c1', tuple_key: { user: 'user:bob' } },
    ]);
  });

  it('includes consistency per item when provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ result: { c0: { allowed: true } } }));
    await client.batchCheck([
      {
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'doc', id: '1' },
        consistency: 'HIGHER_CONSISTENCY',
      },
    ]);
    expect(fetch.body.checks[0].consistency).toBe('HIGHER_CONSISTENCY');
  });

  it('omits consistency from item wire body when not provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ result: { c0: { allowed: true } } }));
    await client.batchCheck([
      {
        subject: { type: 'user', id: 'alice' },
        relation: 'viewer',
        object: { type: 'doc', id: '1' },
      },
    ]);
    expect('consistency' in fetch.body.checks[0]).toBe(false);
  });

  it('forwards authorizationModelId to wire body', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ result: { c0: { allowed: true } } }));
    await client.batchCheck(
      [
        {
          subject: { type: 'user', id: 'alice' },
          relation: 'viewer',
          object: { type: 'doc', id: '1' },
        },
      ],
      { authorizationModelId: 'model-99' },
    );
    expect((fetch.body as Record<string, unknown>).authorization_model_id).toBe('model-99');
  });

  it('returns [] without calling fetch when given empty array', async () => {
    const fetch = vi.fn();
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.batchCheck([]);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('batchCheck — response parsing', () => {
  it('returns results in input order', async () => {
    const fetch = vi.fn().mockResolvedValue(
      mockResponse({
        result: { c0: { allowed: true }, c1: { allowed: false }, c2: { allowed: true } },
      }),
    );
    const client = peretyn({ token: 'tok', fetch });
    const results = await client.batchCheck([
      { subject: { type: 'user', id: 'a' }, relation: 'r', object: { type: 't', id: '1' } },
      { subject: { type: 'user', id: 'b' }, relation: 'r', object: { type: 't', id: '2' } },
      { subject: { type: 'user', id: 'c' }, relation: 'r', object: { type: 't', id: '3' } },
    ]);
    expect(results.map((r) => r.allowed)).toEqual([true, false, true]);
  });

  it('extracts error message per correlation_id', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ result: { c0: { allowed: false, error: { message: 'type not found' } } } }),
      );
    const client = peretyn({ token: 'tok', fetch });
    const check = {
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'doc', id: '1' },
    };
    const results = await client.batchCheck([check]);
    expect(results).toEqual([{ check, allowed: false, error: 'type not found' }]);
  });

  it('returns allowed:false and no error when result entry missing', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ result: {} }));
    const client = peretyn({ token: 'tok', fetch });
    const check = {
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      object: { type: 'doc', id: '1' },
    };
    const results = await client.batchCheck([check]);
    expect(results).toStrictEqual([{ check, allowed: false, error: undefined }]);
  });
});
