'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@peretyn/ui/components/collapsible';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@peretyn/ui/components/sidebar';
import { ChevronRightIcon, FolderIcon, Trash2Icon } from 'lucide-react';
import type { Project } from '@/lib/control/types';
import { PROJECT_PAGES } from './project/project-pages';

const OVERVIEW_PAGE = 'overview';

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

function useOpenWhenActive(isActive: boolean) {
  const [isOpen, setIsOpen] = useState(isActive);
  const [wasActive, setWasActive] = useState(isActive);
  if (isActive !== wasActive) {
    setWasActive(isActive);
    if (isActive) setIsOpen(true);
  }
  return [isOpen, setIsOpen] as const;
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
  const [isOpen, setIsOpen] = useOpenWhenActive(isActive);
  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={project.name} isActive={isActive}>
          <Link href={`${base}/${OVERVIEW_PAGE}${envSuffix}`}>
            <FolderIcon />
            <span>{project.name}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction className="group-data-[state=open]/collapsible:rotate-90">
            <ChevronRightIcon />
            <span className="sr-only">Toggle {project.name} pages</span>
          </SidebarMenuAction>
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
