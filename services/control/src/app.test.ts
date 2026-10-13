import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import * as projectRepository from './repositories/project.repository.js';
import * as environmentRepository from './repositories/environment.repository.js';
import * as memberRepository from './repositories/member.repository.js';
import { DatabaseError } from './db/database.error.js';

vi.mock('./auth.js', () => ({
  auth: { api: { getSession: vi.fn() }, handler: vi.fn() },
}));

const { app } = await import('./app.js');
const { auth } = await import('./auth.js');

const userId = 'u_1';
const organizationId = 'org_1';

beforeEach(() => {
  vi.stubEnv('PERETYN_INTERNAL_SECRET', 'test-secret');
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: userId, email: 'owner@example.com' },
    session: { id: 's_1', userId, activeOrganizationId: organizationId },
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function givenActiveEnvironment(role = 'owner') {
  const projectId = randomUUID();
  const envId = randomUUID();
  vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(
    Result.succeed({ id: projectId, name: 'p', slug: 'p', organizationId, createdAt: new Date() }),
  );
  vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
    Result.succeed({ organizationId, userId, role }),
  );
  vi.spyOn(environmentRepository, 'getEnvironmentByIdAndProjectId').mockResolvedValue(
    Result.succeed({
      id: envId,
      name: 'development',
      projectId,
      externalUuid: randomUUID(),
      openfgaStoreId: 'store_1',
      status: 'active',
      isProduction: false,
      createdAt: new Date(),
    }),
  );
  return { projectId, envId, base: `/manage/v1/projects/${projectId}/environments/${envId}` };
}

function runtimeResponds(status: number, body: unknown) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const checkBody = JSON.stringify({ user: 'user:a', relation: 'viewer', object: 'doc:1' });
const post = (body: string) => ({
  method: 'POST',
  body,
  headers: { 'Content-Type': 'application/json' },
});

describe('id params', () => {
  const projectId = randomUUID();

  it.each([
    ['GET', '/manage/v1/projects/not-a-uuid'],
    ['GET', '/manage/v1/projects/not-a-uuid/environments'],
    ['DELETE', '/manage/v1/projects/not-a-uuid'],
    ['GET', `/manage/v1/projects/${projectId}/environments/not-a-uuid/key`],
    ['GET', `/manage/v1/projects/not-a-uuid/environments/${randomUUID()}/schemas`],
  ])('rejects %s %s with 400 before touching the database', async (method, path) => {
    const getProject = vi.spyOn(projectRepository, 'getProjectById');
    const res = await app.request(path, { method });
    expect(res.status).toBe(400);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('accepts uuids', async () => {
    vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(
      Result.succeed({
        id: projectId,
        name: 'p',
        slug: 'p',
        organizationId,
        createdAt: new Date(),
      }),
    );
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
      Result.succeed({ organizationId, userId, role: 'owner' }),
    );
    vi.spyOn(environmentRepository, 'getEnvironmentsByProjectId').mockResolvedValue(
      Result.succeed([]),
    );
    const res = await app.request(`/manage/v1/projects/${projectId}/environments`);
    expect(res.status).toBe(200);
  });
});

describe('runtime errors', () => {
  it('passes a runtime 400 through with its explanation', async () => {
    const { base } = givenActiveEnvironment();
    runtimeResponds(400, { error: 'type user not found' });
    const res = await app.request(`${base}/check`, post(checkBody));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('type user not found');
  });

  it.each([500, 503])('hides a runtime %i behind a generic 502 and logs it', async (status) => {
    const { base } = givenActiveEnvironment();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    runtimeResponds(status, { error: 'pq: password authentication failed for user "peretyn"' });
    const res = await app.request(`${base}/check`, post(checkBody));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('pq:');
    expect(logged.mock.calls.flat().join()).toContain('pq: password authentication failed');
  });

  it.each([401, 403, 429])(
    'treats a runtime %i on the internal API as our fault (502)',
    async (status) => {
      const { base } = givenActiveEnvironment();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      runtimeResponds(status, { error: 'missing or invalid internal credential' });
      const res = await app.request(`${base}/check`, post(checkBody));
      expect(res.status).toBe(502);
      expect(await res.text()).not.toContain('internal credential');
    },
  );

  it('hides transport errors', async () => {
    const { base } = givenActiveEnvironment();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('connect ECONNREFUSED 10.0.0.5:8081')),
    );
    const res = await app.request(`${base}/check`, post(checkBody));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('ECONNREFUSED');
  });
});

describe('server errors', () => {
  it('keeps malformed JSON a 400', async () => {
    const { base } = givenActiveEnvironment();
    const res = await app.request(`${base}/check`, post('{"user":'));
    expect(res.status).toBe(400);
  });

  it('logs a database error and answers 500', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
      Result.fail(
        new DatabaseError({ entity: 'member', operation: 'read', error: new Error('ECONNRESET') }),
      ),
    );
    const res = await app.request('/manage/v1/projects');
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('ECONNRESET');
    expect(logged.mock.calls.flat().join()).toContain('ECONNRESET');
  });

  it('answers an unexpected throw with JSON and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(memberRepository, 'getMembership').mockRejectedValue(new Error('kaboom'));
    const res = await app.request('/manage/v1/projects');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.text()).not.toContain('kaboom');
    expect(logged.mock.calls.flat().join()).toContain('kaboom');
  });
});

describe('tuples', () => {
  it('hands the runtime continuation token to the dashboard', async () => {
    const { base } = givenActiveEnvironment();
    const fetch = runtimeResponds(200, {
      tuples: [
        {
          key: { user: 'user:a', relation: 'viewer', object: 'doc:1', condition: null },
          timestamp: '2026-10-07T10:29:33.915273Z',
        },
      ],
      continuation_token: 'next-page',
    });
    const res = await app.request(`${base}/tuples?pageSize=1&continuationToken=this-page`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tuples: [
        {
          user: 'user:a',
          relation: 'viewer',
          object: 'doc:1',
          timestamp: '2026-10-07T10:29:33.915273Z',
        },
      ],
      continuationToken: 'next-page',
    });
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
      page_size: 1,
      continuation_token: 'this-page',
    });
  });
});

describe('publish', () => {
  const bearer = (key: string, body: string) => ({
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  });

  it('authenticates the env key before reading the body', async () => {
    runtimeResponds(401, { error: 'missing or unknown bearer token' });
    const res = await app.request('/publish/v1/schema', bearer('prn_dev_bad', '{"label":'));
    expect(res.status).toBe(401);
  });

  it('refuses a body over the limit without calling the runtime', async () => {
    const fetch = runtimeResponds(200, {});
    const res = await app.request(
      '/publish/v1/schema',
      bearer('prn_dev_good', JSON.stringify({ label: 'v1', dsl: 'x'.repeat(2 * 1024 * 1024) })),
    );
    expect(res.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
