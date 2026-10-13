'use client';

import * as React from 'react';

import {
  type OrganizationAuthClient,
  useActiveOrganization,
  useAuth,
  useAuthPlugin,
} from '@better-auth-ui/react';

import { NavProjects } from '@/components/nav-projects';
import { UserButton } from '@/components/auth/user/user-button';
import { UserView } from '@/components/auth/user/user-view';
import { organizationPlugin } from '@/lib/auth/organization-plugin';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@peretyn/ui/components/sidebar';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { OrganizationSwitcher } from './auth/organization/organization-switcher';
import { OrganizationView } from './auth/organization/organization-view';
import { CreateOrganizationDialog } from './auth/organization/create-organization-dialog';

const triggerClassName =
  'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground';

function OrganizationTriggerContent() {
  const { authClient } = useAuth();
  const { localization: organizationLocalization } = useAuthPlugin(organizationPlugin);
  const { data: activeOrganization, isPending } = useActiveOrganization(
    authClient as OrganizationAuthClient,
  );

  const showPlaceholder = !isPending && !activeOrganization;

  return (
    <>
      <OrganizationView
        hideRole
        hideSlug
        organization={showPlaceholder ? { name: organizationLocalization.organization } : undefined}
      />

      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
    </>
  );
}

function CreateOrganizationButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <SidebarMenuButton
        size="lg"
        tooltip="Create organization"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg border">
          <Plus className="size-4" />
        </div>
        <span className="font-medium">Create organization</span>
      </SidebarMenuButton>
      <CreateOrganizationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

type MenuAlign = 'start' | 'center';

function OrganizationMenu({ menuAlign }: { menuAlign: MenuAlign }) {
  const { authClient } = useAuth();
  const { data: activeOrganization } = useActiveOrganization(authClient as OrganizationAuthClient);

  if (!activeOrganization) return <CreateOrganizationButton />;
  return (
    <OrganizationSwitcher
      hidePersonal
      align={menuAlign}
      sideOffset={4}
      trigger={
        <SidebarMenuButton size="lg" className={triggerClassName}>
          <OrganizationTriggerContent />
        </SidebarMenuButton>
      }
    />
  );
}

function UserMenu({ menuAlign }: { menuAlign: MenuAlign }) {
  return (
    <UserButton
      align={menuAlign}
      sideOffset={4}
      trigger={
        <SidebarMenuButton size="lg" className={triggerClassName}>
          <UserView />
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
        </SidebarMenuButton>
      }
    />
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authClient } = useAuth();
  const { state, isMobile } = useSidebar();
  const menuAlign = state === 'collapsed' && !isMobile ? 'start' : 'center';

  const { data: activeOrganization } = useActiveOrganization(authClient as OrganizationAuthClient);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrganizationMenu menuAlign={menuAlign} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {activeOrganization && <NavProjects organizationId={activeOrganization.id} />}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu menuAlign={menuAlign} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
