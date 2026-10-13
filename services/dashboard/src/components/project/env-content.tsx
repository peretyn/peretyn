'use client';

import { Fragment, type ReactNode } from 'react';
import { Skeleton } from '@peretyn/ui/components/skeleton';
import { QueryError } from '@/components/query-error';
import { useCurrentEnvironment } from '@/lib/control/environments';
import type { Environment } from '@/lib/control/types';

export function EnvContent({
  projectId,
  children,
}: {
  projectId: string;
  children: (environment: Environment) => ReactNode;
}) {
  const { environment, isPending, error } = useCurrentEnvironment(projectId);

  if (error) return <QueryError error={error} />;

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!environment) {
    return (
      <p className="text-sm text-muted-foreground">This environment isn&apos;t available yet.</p>
    );
  }

  return <Fragment key={environment.id}>{children(environment)}</Fragment>;
}
