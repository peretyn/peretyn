import { describe, it, expect, vi } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch, mockResponse } from './test-helpers.js';

describe('readChanges — wire format', () => {
  it('uses GET method', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    await client.readChanges();
    expect(fetch.init.method).toBeUndefined();
  });

  it('includes /v1/changes in the URL when no params provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    await client.readChanges();
    expect(fetch.url).toContain('/v1/changes');
  });

  it('does not append trailing ? when no params provided', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    await client.readChanges();
    expect(fetch.url).not.toContain('?');
  });

  it('forwards type param', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    await client.readChanges({ type: 'document' });
    expect(fetch.url).toContain('type=document');
  });

  it('forwards continuationToken as continuation_token param', async () => {
    const fetch = captureFetch();
    const client = peretyn({ token: 'tok', fetch });
    fetch.mockResolvedValueOnce(mockResponse({ changes: [] }));
    await client.readChanges({ continuationToken: 'tok123' });
    expect(fetch.url).toContain('continuation_token=tok123');
  });
});

describe('readChanges — response parsing', () => {
  it('returns changes array and continuationToken', async () => {
    const changes = [{ type: 'write' }];
    const fetch = vi.fn().mockResolvedValue(mockResponse({ changes, continuation_token: 'next' }));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.readChanges();
    expect(result.changes).toEqual(changes);
    expect(result.continuationToken).toBe('next');
  });

  it('returns empty changes and no continuationToken when absent', async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({}));
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.readChanges();
    expect(result.changes).toEqual([]);
    expect(result.continuationToken).toBeUndefined();
  });
});
