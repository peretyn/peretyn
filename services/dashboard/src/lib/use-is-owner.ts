'use client';

import { organizationQueryKeys } from '@better-auth-ui/core/plugins';
import {
  type OrganizationAuthClient,
  useActiveOrganization,
  useAuth,
  useAuthQuery,
  useSession,
} from '@better-auth-ui/react';
import { isOwnerRole } from '@peretyn/org-roles';

export function useIsOrgOwner() {
  const { authClient } = useAuth();
  const organizationClient = authClient as OrganizationAuthClient;
  const { data: session } = useSession(authClient);
  const { data: organization } = useActiveOrganization(organizationClient);
  const { data, isPending, error } = useAuthQuery(
    organizationClient.organization.getActiveMemberRole,
    [...organizationQueryKeys.all(session?.user.id), 'activeMemberRole'],
    { query: { organizationId: organization?.id }, enabled: Boolean(organization) },
  );

  return { isOwner: data ? isOwnerRole(data.role) : undefined, isPending, error };
}
