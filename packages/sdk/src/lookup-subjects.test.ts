import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('lookupSubjects — wire format', () => {
  it('posts to /v1/list-users with object, relation, user_filters', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ users: [] }));
    await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'user',
    });
    expect(fetch.url).toBe('http://localhost:8080/v1/list-users');
    expect(fetch.body).toMatchObject({
      object: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      user_filters: [{ type: 'user' }],
    });
  });
});

describe('lookupSubjects — response parsing', () => {
  it('parses object refs to "type:id"', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ users: [{ object: { type: 'user', id: 'alice' } }] }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'user',
    });
    expect(result.subjects).toEqual(['user:alice']);
  });

  it('parses userset refs to "type:id#relation"', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ users: [{ userset: { type: 'tenant', id: 't1', relation: 'admin' } }] }),
      );
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'tenant',
    });
    expect(result.subjects).toEqual(['tenant:t1#admin']);
  });

  it('parses userset with no relation to "type:id"', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ users: [{ userset: { type: 'tenant', id: 't1' } }] }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'tenant',
    });
    expect(result.subjects).toEqual(['tenant:t1']);
  });

  it('parses wildcard users to "type:*"', async () => {
    const fetch = vi.fn().mockResolvedValue(
      mockResponse({
        users: [{ wildcard: { type: 'user' } }, { object: { type: 'user', id: 'a' } }],
      }),
    );
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'user',
    });
    expect(result.subjects).toEqual(['user:*', 'user:a']);
  });

  it('returns empty subjects when users array absent', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'user',
    });
    expect(result.subjects).toEqual([]);
  });

  it('filters out malformed entries with neither object nor userset', async () => {
    const fetch = vi.fn().mockResolvedValue(
      mockResponse({
        users: [
          { object: { type: 'user', id: 'alice' } },
          {},
          { userset: { type: 'tenant', id: 't1' } },
        ],
      }),
    );
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.lookupSubjects({
      resource: { type: 'document', id: 'doc1' },
      relation: 'viewer',
      subjectType: 'user',
    });
    expect(result.subjects).toEqual(['user:alice', 'tenant:t1']);
  });
});
