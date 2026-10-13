import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('expand — wire format', () => {
  it('posts to /v1/expand with tuple_key containing only relation + object (no user)', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ tree: { root: {} } }));
    await client.expand({ relation: 'viewer', object: { type: 'document', id: 'doc1' } });
    expect(fetch.url).toBe('http://localhost:8080/v1/expand');
    const body = fetch.body as { tuple_key: Record<string, unknown> };
    expect(body.tuple_key).toEqual({ relation: 'viewer', object: 'document:doc1' });
    expect(body.tuple_key).not.toHaveProperty('user');
  });

  it('forwards authorizationModelId', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ tree: { root: {} } }));
    await client.expand({
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
      authorizationModelId: 'model-abc',
    });
    expect((fetch.body as Record<string, unknown>).authorization_model_id).toBe('model-abc');
  });
});

describe('expand — response parsing', () => {
  it('extracts tree.root not tree itself', async () => {
    const root = { name: 'document:doc1#viewer', union: { nodes: [] } };
    const fetch = vi.fn().mockResolvedValue(mockResponse({ tree: { root } }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.expand({
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
    });
    expect(result.tree).toEqual(root);
  });

  it('returns tree:undefined when response has no tree', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.expand({
      relation: 'viewer',
      object: { type: 'document', id: 'doc1' },
    });
    expect(result.tree).toBeUndefined();
  });
});
