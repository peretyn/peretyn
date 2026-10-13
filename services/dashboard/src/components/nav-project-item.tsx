'use client';

import Link from 'next/link';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@peretyn/ui/components/collapsible';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@peretyn/ui/components/sidebar';
import { ChevronRightIcon, FolderIcon, Trash2Icon } from 'lucide-react';
import type { Project } from '@/lib/control/types';
import { PROJECT_PAGES } from './project/project-pages';

type NavProjectItemProps = {
  project: Project;
  pathname: string;
  envSuffix: string;
  isOwner: boolean;
  onDelete: (project: Project) => void;
};

function ProjectPageLinks({
  base,
  pathname,
  envSuffix,
}: {
  base: string;
  pathname: string;
  envSuffix: string;
}) {
  return PROJECT_PAGES.map((page) => {
    const href = `${base}/${page.slug}`;
    return (
      <SidebarMenuSubItem key={page.slug}>
        <SidebarMenuSubButton asChild isActive={pathname === href}>
          <Link href={`${href}${envSuffix}`}>{page.label}</Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  });
}

function DeleteProjectItem({ onClick }: { onClick: () => void }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild className="text-muted-foreground hover:text-destructive">
        <button type="button" onClick={onClick}>
          <Trash2Icon />
          <span>Delete project</span>
        </button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function NavProjectItem({
  project,
  pathname,
  envSuffix,
  isOwner,
  onDelete,
}: NavProjectItemProps) {
  const base = `/projects/${project.id}`;
  const isActive = pathname.startsWith(base);
  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={project.name} isActive={isActive}>
            <FolderIcon />
            <span>{project.name}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <ProjectPageLinks base={base} pathname={pathname} envSuffix={envSuffix} />
            {isOwner && <DeleteProjectItem onClick={() => onDelete(project)} />}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
