import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('better-auth/cookies', () => ({
  getSessionCookie: vi.fn(),
}));

const { getSessionCookie } = await import('better-auth/cookies');
const { proxy, config } = await import('./proxy');

describe('proxy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /auth/sign-in with redirectTo when no session cookie', () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);

    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/auth/sign-in?redirectTo=%2Fdashboard',
    );
  });

  it('keeps the query string in redirectTo and nothing else on the sign-in URL', () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);

    const req = new NextRequest('http://localhost:3000/projects/p1/tuples?env=development&page=2');
    const location = new URL(proxy(req).headers.get('location') ?? '');

    expect(location.pathname).toBe('/auth/sign-in');
    expect([...location.searchParams.keys()]).toEqual(['redirectTo']);
    expect(location.searchParams.get('redirectTo')).toBe(
      '/projects/p1/tuples?env=development&page=2',
    );
  });

  it('passes through when session cookie is present', () => {
    vi.mocked(getSessionCookie).mockReturnValue('session-token-value');

    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = proxy(req);

    expect(res.status).toBe(200);
  });

  it('allows unauthenticated access to auth pages', () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);

    const req = new NextRequest('http://localhost:3000/auth/sign-in');
    const res = proxy(req);

    expect(res.status).toBe(200);
  });

  it.each([
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/forgot-password',
    '/auth/sign-out',
    '/auth/reset-password',
  ])('passes /auth path %s through even with a session cookie', (pathname) => {
    vi.mocked(getSessionCookie).mockReturnValue('session-token-value');

    const req = new NextRequest(`http://localhost:3000${pathname}`);
    const res = proxy(req);

    expect(res.status).toBe(200);
  });
});

describe('proxy matcher', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it.each(['/publish/v1/schema', '/publish/v1/schema/plan'])('does not gate %s', (pathname) => {
    expect(matches(pathname)).toBe(false);
  });

  it.each(['/manage/v1/projects', '/manage/v1/projects/p1/environments'])(
    'leaves %s to control, which answers 401 JSON',
    (pathname) => {
      expect(matches(pathname)).toBe(false);
    },
  );

  it.each(['/dashboard', '/organization/settings', '/', '/projects/p1/api-key'])(
    'still gates %s',
    (pathname) => {
      expect(matches(pathname)).toBe(true);
    },
  );
});
