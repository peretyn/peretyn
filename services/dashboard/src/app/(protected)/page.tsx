'use client';

import { type OrganizationAuthClient, useActiveOrganization, useAuth } from '@better-auth-ui/react';
import { FolderIcon } from 'lucide-react';

import { Spinner } from '@peretyn/ui/components/spinner';
import { AppHeader } from '@/components/app-header';
import { OrgGate } from '@/components/org-gate';

export default function DashboardHome() {
  const { authClient } = useAuth();
  const { data: activeOrganization, isPending } = useActiveOrganization(
    authClient as OrganizationAuthClient,
  );

  return (
    <>
      <AppHeader crumbs={[{ label: activeOrganization ? 'Dashboard' : 'Welcome' }]} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <HomeContent isPending={isPending} hasActiveOrganization={Boolean(activeOrganization)} />
      </div>
    </>
  );
}

function HomeContent({
  isPending,
  hasActiveOrganization,
}: {
  isPending: boolean;
  hasActiveOrganization: boolean;
}) {
  if (isPending) return <Spinner />;
  if (hasActiveOrganization) return <PickProject />;
  return <OrgGate />;
}

function PickProject() {
  return (
    <>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderIcon className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Pick a project to get started</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Select a project in the sidebar, or create one with New project.
        </p>
      </div>
    </>
  );
}
