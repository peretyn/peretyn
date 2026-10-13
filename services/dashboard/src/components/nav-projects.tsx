'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@peretyn/ui/components/sidebar';
import { PlusIcon } from 'lucide-react';
import { useEnvParam } from '@/lib/control/environments';
import { useProjects } from '@/lib/control/projects';
import { useIsOrgOwner } from '@/lib/use-is-owner';
import type { Project } from '@/lib/control/types';
import { NavProjectItem } from './nav-project-item';
import { CreateProjectDialog } from './project/create-project-dialog';
import { DeleteProjectDialog } from './project/delete-project-dialog';

const SKELETON_COUNT = 3;
const MUTED_ROW_CLASS_NAME =
  'px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden';

function ProjectListStatus({
  isPending,
  isError,
  projects,
}: {
  isPending: boolean;
  isError: boolean;
  projects: Project[] | undefined;
}) {
  return (
    <>
      {isPending &&
        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}

      {isError && (
        <SidebarMenuItem className={MUTED_ROW_CLASS_NAME}>
          Couldn&apos;t load projects.
        </SidebarMenuItem>
      )}

      {projects?.length === 0 && (
        <SidebarMenuItem className={MUTED_ROW_CLASS_NAME}>No projects yet.</SidebarMenuItem>
      )}
    </>
  );
}

function NewProjectItem({ onClick }: { onClick: () => void }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="New project"
        onClick={onClick}
        className="text-sidebar-foreground/70"
      >
        <PlusIcon />
        <span>New project</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function useEnvSuffix(): string {
  return useEnvParam() === 'development' ? '?env=development' : '';
}

export function NavProjects({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const { data: projects, isPending, isError } = useProjects(organizationId);
  const { isOwner } = useIsOrgOwner();
  const envSuffix = useEnvSuffix();

  const [createOpen, setCreateOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>

      <SidebarMenu>
        <ProjectListStatus isPending={isPending} isError={isError} projects={projects} />

        {projects?.map((project) => (
          <NavProjectItem
            key={project.id}
            project={project}
            pathname={pathname}
            envSuffix={envSuffix}
            isOwner={Boolean(isOwner)}
            onDelete={setProjectToDelete}
          />
        ))}

        {isOwner && <NewProjectItem onClick={() => setCreateOpen(true)} />}
      </SidebarMenu>

      <CreateProjectDialog
        organizationId={organizationId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <DeleteProjectDialog
        organizationId={organizationId}
        project={projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      />
    </SidebarGroup>
  );
}
