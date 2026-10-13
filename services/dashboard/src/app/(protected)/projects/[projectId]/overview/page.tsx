'use client';

import { use } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, DatabaseIcon, KeyRoundIcon, ListIcon } from 'lucide-react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import { CodeBlock } from '@/components/project/code-block';
import { CopyButton } from '@/components/copy-button';
import { EnvContent } from '@/components/project/env-content';
import { maskKey, useEnvironmentKey } from '@/lib/control/environments';
import { useSchemaShape } from '@/lib/control/schemas';
import { useTuples } from '@/lib/control/tuples';
import type { Environment, Tuple } from '@/lib/control/types';

export default function OverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <EnvContent projectId={projectId}>
      {(environment) => <Overview projectId={projectId} environment={environment} />}
    </EnvContent>
  );
}

type Stat = {
  label: string;
  value: string;
  icon: typeof DatabaseIcon;
  mono?: boolean;
  copyValue?: string;
};

const TUPLE_COUNT_PAGE_SIZE = 100;

function formatTupleCount(
  tuples: { tuples: Tuple[]; continuationToken?: string } | undefined,
): string {
  if (!tuples) return '—';
  return `${tuples.tuples.length}${tuples.continuationToken ? '+' : ''}`;
}

function buildStats({
  environment,
  tupleCount,
  maskedKey,
}: {
  environment: Environment;
  tupleCount: string;
  maskedKey: string;
}): Stat[] {
  return [
    {
      label: 'Store ID',
      value: environment.openfgaStoreId ?? '—',
      icon: DatabaseIcon,
      mono: true,
      copyValue: environment.openfgaStoreId ?? undefined,
    },
    { label: 'Tuples', value: tupleCount, icon: ListIcon },
    { label: 'Active key', value: maskedKey, icon: KeyRoundIcon, mono: true },
    {
      label: 'Created',
      value: format(new Date(environment.createdAt), 'MMM d, yyyy'),
      icon: CalendarIcon,
    },
  ];
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <stat.icon className="size-3.5" />
          {stat.label}
        </CardDescription>
        <CardTitle className={`truncate text-xl ${stat.mono ? 'font-mono' : ''}`}>
          {stat.value}
        </CardTitle>
        {stat.copyValue && (
          <CardAction>
            <CopyButton value={stat.copyValue} label={`Copy ${stat.label}`} />
          </CardAction>
        )}
      </CardHeader>
    </Card>
  );
}

function Overview({ projectId, environment }: { projectId: string; environment: Environment }) {
  const { data: key } = useEnvironmentKey(projectId, environment.id);
  const { data: tuples } = useTuples(projectId, environment.id, {
    pageSize: TUPLE_COUNT_PAGE_SIZE,
  });
  const { sample } = useSchemaShape(projectId, environment.id);

  const stats = buildStats({
    environment,
    tupleCount: formatTupleCount(tuples),
    maskedKey: key ? maskKey(key) : '—',
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connect your app</CardTitle>
          <CardDescription>
            Point the SDK at this environment with its key. The store is resolved from the token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={snippet(key?.keyLast4, sample)} />
        </CardContent>
      </Card>
    </div>
  );
}

function parseRef(ref: string | undefined): { type: string; id: string } | null {
  const [type, id] = ref?.split(':') ?? [];
  return type && id ? { type, id } : null;
}

function snippet(last4: string | undefined, sample: Tuple | null): string {
  const subject = parseRef(sample?.user) ?? { type: 'user', id: 'u_42' };
  const object = parseRef(sample?.object) ?? { type: 'document', id: 'doc_99' };
  const relation = sample?.relation ?? 'can_edit';
  return `import { peretyn } from '@peretyn/sdk';
import { schema } from './schema';

// the type parameter is what gives check/write/lookup their autocomplete
const client = peretyn<typeof schema>({
  token: process.env.PERETYN_TOKEN!, // ${last4 ? `…${last4}` : 'your env key'}
  baseUrl: process.env.PERETYN_RUNTIME_URL!,
});

const { allowed } = await client.check({
  subject: { type: '${subject.type}', id: '${subject.id}' },
  relation: '${relation}',
  object: { type: '${object.type}', id: '${object.id}' },
});`;
}
