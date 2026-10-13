import { describe, it, expect } from 'vitest';
import { peretyn } from './index.js';
import { captureFetch } from './test-helpers.js';

describe('me', () => {
  it('sends GET to /v1/me with bearer token and returns context fields', async () => {
    const fetch = captureFetch({
      storeId: 's1',
      environment: 'prod',
      projectSlug: 'my-app',
      kind: 'env',
    });
    const client = peretyn({ token: 'tok', fetch });
    const result = await client.me();
    expect(fetch.url).toBe('http://localhost:8080/v1/me');
    expect(fetch.init.method).toBeUndefined();
    expect(fetch.init.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(result).toEqual({
      storeId: 's1',
      environment: 'prod',
      projectSlug: 'my-app',
      kind: 'env',
    });
  });
});
