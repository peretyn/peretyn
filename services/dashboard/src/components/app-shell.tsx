'use client';

import { useEffect, useState } from 'react';
import {
  type OrganizationAuthClient,
  useActiveOrganization,
  useAuth,
  useListOrganizations,
  useSetActiveOrganization,
} from '@better-auth-ui/react';

import { SidebarInset, SidebarProvider } from '@peretyn/ui/components/sidebar';
import { Spinner } from '@peretyn/ui/components/spinner';
import { AppSidebar } from './app-sidebar';

function useAutoSelectOrganization() {
  const { authClient } = useAuth();
  const { data: activeOrganization, isPending: activePending } = useActiveOrganization(
    authClient as OrganizationAuthClient,
  );
  const { data: organizations, isPending: listPending } = useListOrganizations(
    authClient as OrganizationAuthClient,
  );
  const [failedOrganizationId, setFailedOrganizationId] = useState<string | null>();
  const { mutate: setActiveOrganization } = useSetActiveOrganization(
    authClient as OrganizationAuthClient,
    { onError: (_error, variables) => setFailedOrganizationId(variables?.organizationId) },
  );

  const isPending = activePending || listPending;
  const firstOrganizationId = organizations?.[0]?.id;
  const autoSelectId =
    !isPending && !activeOrganization && firstOrganizationId !== failedOrganizationId
      ? firstOrganizationId
      : undefined;

  useEffect(() => {
    if (autoSelectId) setActiveOrganization({ organizationId: autoSelectId });
  }, [autoSelectId, setActiveOrganization]);

  return { isPending, autoSelectId };
}

export function AppShell({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const { isPending, autoSelectId } = useAutoSelectOrganization();

  if (isPending || autoSelectId) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
