import { basePaths, viewPaths } from '@better-auth-ui/core';
import { notFound, redirect } from 'next/navigation';

import { Auth } from '@/components/auth/auth';
import { AuthSettingsProvider } from '@/components/auth-settings-provider';
import type { AuthSettings } from '@/lib/auth-settings';
import { getAuthSettings } from '@/lib/auth-settings.server';
import { redirectIfAuthenticated } from '@/lib/dal';
import { sameOriginPath } from '@/lib/same-origin-path';

function isViewAvailable(path: string, settings: AuthSettings): boolean {
  if (path === viewPaths.auth.signUp) return settings.signUp;
  if (path === viewPaths.auth.forgotPassword) return settings.passwordReset;
  return true;
}

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

  const settings = await getAuthSettings();
  if (!isViewAvailable(path, settings)) {
    redirect(`${basePaths.auth}/${viewPaths.auth.signIn}`);
  }

  return (
    <AuthSettingsProvider settings={settings}>
      <Auth path={path} redirectTo={safeRedirectTo} />
    </AuthSettingsProvider>
  );
}
