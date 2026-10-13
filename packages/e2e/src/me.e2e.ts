import { describe, it, expect, beforeAll, inject } from 'vitest';
import type { PeretynClient } from '@peretyn/sdk';
import { connectClient } from './client.js';

const runtimeUrl = inject('runtimeUrl');
const token = inject('token');

let client: PeretynClient;

beforeAll(() => {
  client = connectClient({ token, baseUrl: runtimeUrl });
});

describe('me', () => {
  it('returns token context with the provisioned store and environment', async () => {
    const ctx = await client.me();
    expect(ctx.environment).toBe('e2e');
    expect(ctx.projectSlug).toBe('peretyn-e2e');
    expect(ctx.kind).toBe('env');
    expect(ctx.storeId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
