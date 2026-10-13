import { basePaths } from '@better-auth-ui/core';
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
import { SIGN_IN_PATH } from './lib/sign-in-path';

const AUTH_BASE = basePaths.auth;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthPath = pathname === AUTH_BASE || pathname.startsWith(`${AUTH_BASE}/`);

  if (isAuthPath) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = new URLSearchParams({ redirectTo: `${pathname}${search}` }).toString();
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|publish|manage|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.ico).*)',
  ],
};
