'use client';

import { use } from 'react';

import { ChevronDownIcon } from 'lucide-react';

import { Badge } from '@peretyn/ui/components/badge';
import { Button } from '@peretyn/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@peretyn/ui/components/collapsible';
import { Skeleton } from '@peretyn/ui/components/skeleton';
import { CodeBlock } from '@/components/project/code-block';
import { EnvContent } from '@/components/project/env-content';
import { SchemaDeployGuide } from '@/components/project/schema-deploy-guide';
import { QueryError } from '@/components/query-error';
import { useLatestSchema } from '@/lib/control/schemas';
import type { Environment, SchemaVersion } from '@/lib/control/types';

export default function SchemaPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <EnvContent projectId={projectId}>
      {(environment) => <SchemaView projectId={projectId} environment={environment} />}
    </EnvContent>
  );
}

function SchemaView({ projectId, environment }: { projectId: string; environment: Environment }) {
  const { data: latest, isPending, error } = useLatestSchema(projectId, environment.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authorization model</CardTitle>
        <CardDescription>
          Read-only. The schema is authored as code and deployed via the peretyn CLI.
        </CardDescription>
        {latest && (
          <CardAction>
            <Badge variant="secondary" className="font-mono">
              {latest.label}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <SchemaBody isPending={isPending} error={error} latest={latest} />
      </CardContent>
    </Card>
  );
}

function SchemaBody({
  isPending,
  error,
  latest,
}: {
  isPending: boolean;
  error: Error | null;
  latest: SchemaVersion | null | undefined;
}) {
  if (error) return <QueryError error={error} />;
  if (isPending) return <Skeleton className="h-64 w-full" />;

  if (!latest) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          No schema published yet. Define your model as code and deploy it to this environment with
          the peretyn CLI.
        </p>
        <SchemaDeployGuide />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CodeBlock code={latest.dslSource} />
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ChevronDownIcon className="transition-transform group-data-[state=open]/button:rotate-180" />
            Deploy a new version
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <SchemaDeployGuide />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
