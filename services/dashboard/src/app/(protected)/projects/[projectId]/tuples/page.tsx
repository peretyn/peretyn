'use client';

import { use } from 'react';

import { EnvContent } from '@/components/project/env-content';
import { Tuples } from '@/components/project/tuples/tuples';

export default function TuplesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <EnvContent projectId={projectId}>
      {(environment) => <Tuples projectId={projectId} environment={environment} />}
    </EnvContent>
  );
}
