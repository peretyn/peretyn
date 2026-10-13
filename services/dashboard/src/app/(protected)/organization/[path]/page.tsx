import { notFound } from 'next/navigation';
import { Organization } from '@/components/auth/organization/organization';

import { AppHeader } from '@/components/app-header';
import { organizationPlugin } from '@/lib/auth/organization-plugin';

const validOrganizationPaths = Object.values(organizationPlugin().viewPaths.organization);

export default async function OrganizationPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  if (!validOrganizationPaths.includes(path)) {
    notFound();
  }

  return (
    <>
      <AppHeader
        crumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Settings', href: '/settings/organizations' },
          { label: 'Organization' },
        ]}
      />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <Organization path={path} />
      </div>
    </>
  );
}
