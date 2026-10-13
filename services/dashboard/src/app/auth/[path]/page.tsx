import { basePaths, viewPaths } from '@better-auth-ui/core';
import { notFound, redirect } from 'next/navigation';

import { Auth } from '@/components/auth/auth';
import { redirectIfAuthenticated } from '@/lib/dal';
import { sameOriginPath } from '@/lib/same-origin-path';

const GUEST_ONLY_VIEWS: string[] = [
  viewPaths.auth.signIn,
  viewPaths.auth.signUp,
  viewPaths.auth.forgotPassword,
];

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string }>;
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  const { path } = await params;
  const { redirectTo } = await searchParams;

  if (!Object.values(viewPaths.auth).includes(path)) {
    notFound();
  }

  const safeRedirectTo = sameOriginPath(redirectTo);
  if (redirectTo !== undefined && !safeRedirectTo) {
    redirect(`${basePaths.auth}/${path}`);
  }

  if (GUEST_ONLY_VIEWS.includes(path)) {
    await redirectIfAuthenticated();
  }

  return <Auth path={path} redirectTo={safeRedirectTo} />;
}
