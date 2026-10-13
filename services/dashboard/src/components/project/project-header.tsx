'use client';

import { usePathname } from 'next/navigation';

import { Badge } from '@peretyn/ui/components/badge';
import { AppHeader } from '@/components/app-header';
import { useProject } from '@/lib/control/projects';
import { useIsOrgOwner } from '@/lib/use-is-owner';
import { EnvSwitcher } from './env-switcher';
import { PROJECT_PAGES } from './project-pages';

export function ProjectHeader({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { data: project } = useProject(projectId);
  const { isOwner } = useIsOrgOwner();

  const segment = pathname.split('/').pop();
  const pageLabel = PROJECT_PAGES.find((page) => page.slug === segment)?.label ?? 'Overview';

  return (
    <AppHeader
      crumbs={[
        { label: 'Dashboard', href: '/' },
        { label: project?.name ?? 'Project', href: `/projects/${projectId}/overview` },
        { label: pageLabel },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {isOwner === false && <Badge variant="secondary">Development</Badge>}
          <EnvSwitcher />
        </div>
      }
    />
  );
}
