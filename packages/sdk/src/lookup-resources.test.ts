import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('lookupResources — wire format', () => {
  it('posts to /v1/list-objects with type, relation, user', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ objects: [] }));
    await client.lookupResources({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      resourceType: 'document',
    });
    expect(fetch.url).toBe('http://localhost:8080/v1/list-objects');
    expect(fetch.body).toMatchObject({ type: 'document', relation: 'viewer', user: 'user:alice' });
  });
});

describe('lookupResources — response parsing', () => {
  it('strips type: prefix from returned IDs', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ objects: ['document:doc1', 'document:doc2'] }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupResources({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      resourceType: 'document',
    });
    expect(result.ids).toEqual(['doc1', 'doc2']);
  });

  it('returns {ids:[]} when objects array is absent', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupResources({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      resourceType: 'document',
    });
    expect(result.ids).toEqual([]);
  });

  it('does not strip prefix if type does not match', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ objects: ['other:doc1'] }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupResources({
      subject: { type: 'user', id: 'alice' },
      relation: 'viewer',
      resourceType: 'document',
    });
    expect(result.ids).toEqual(['other:doc1']);
  });
});
