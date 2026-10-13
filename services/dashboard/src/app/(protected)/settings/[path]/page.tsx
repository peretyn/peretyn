import { authQueryKeys, viewPaths } from '@better-auth-ui/core';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { Settings } from '@/components/auth/settings/settings';
import { AppHeader } from '@/components/app-header';
import { getQueryClient } from '@/lib/query-client';
import { verifySession } from '@/lib/dal';
import { organizationPlugin } from '@/lib/auth/organization-plugin';

const validSettingsPaths = [
  ...Object.values(viewPaths.settings),
  ...Object.values(organizationPlugin().viewPaths.settings),
];

export default async function SettingsPage({
  params,
}: {
  params: Promise<{
    path: string;
  }>;
}) {
  const { path } = await params;

  if (!validSettingsPaths.includes(path)) {
    notFound();
  }

  const queryClient = getQueryClient();
  const session = await verifySession();

  queryClient.setQueryData(authQueryKeys.session, session);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppHeader crumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]} />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <Settings path={path} />
      </div>
    </HydrationBoundary>
  );
}
