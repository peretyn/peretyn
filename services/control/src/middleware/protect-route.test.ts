import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVariables } from './protect-route.js';

vi.mock('../auth.js', () => ({
  auth: {
    $Infer: { Session: { user: null, session: null } },
    api: {
      getSession: vi.fn(),
    },
  },
}));

const { protectRoute } = await import('./protect-route.js');
const { auth } = await import('../auth.js');

describe('protectRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const app = new Hono().use('*', protectRoute).get('/', (c) => c.json({ ok: true }));
    const res = await app.request('/');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Unauthorized' });
  });

  it('sets user and session on context when session exists', async () => {
    const fakeSession = {
      user: { id: 'user1', email: 'user1@example.com' },
      session: { id: 'sess1', userId: 'user1' },
    };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as never);

    const app = new Hono()
      .use('*', protectRoute)
      .get('/', (c) => c.json({ user: c.get('user'), session: c.get('session') }));
    const res = await app.request('/');

    expect(res.status).toBe(200);
    const body = (await res.json()) as AuthVariables;
    expect(body.user).toEqual(fakeSession.user);
    expect(body.session).toEqual(fakeSession.session);
  });
});
