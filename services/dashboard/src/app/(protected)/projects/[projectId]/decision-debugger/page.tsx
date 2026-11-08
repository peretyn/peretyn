'use client';

import { type SyntheticEvent, use, useState } from 'react';
import { CheckIcon, PlayIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import type { ExpandTreeNode } from '@peretyn/sdk';
import { Button } from '@peretyn/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import { Spinner } from '@peretyn/ui/components/spinner';
import { cn } from '@peretyn/ui/lib/utils';
import { EnvContent } from '@/components/project/env-content';
import { NoSchemaGuide } from '@/components/project/no-schema-guide';
import { ProofTree } from '@/components/project/proof-tree';
import { isComplete, TupleFields, useTupleDraft } from '@/components/project/tuple-fields';
import { QueryError } from '@/components/query-error';
import { ControlError } from '@/lib/control/client';
import { useCheck, useExpand } from '@/lib/control/decisions';
import { type SchemaShape, useLatestSchema, useSchemaShape } from '@/lib/control/schemas';
import type { Environment, Tuple } from '@/lib/control/types';

export default function DecisionDebuggerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <EnvContent projectId={projectId}>
      {(environment) => <Debugger projectId={projectId} environment={environment} />}
    </EnvContent>
  );
}

function useDecisionRun({
  projectId,
  environmentId,
}: {
  projectId: string;
  environmentId: string;
}) {
  const [asked, setAsked] = useState<Tuple | null>(null);
  const { mutate: runCheck, data: result, isPending } = useCheck(projectId, environmentId);
  const {
    mutate: runExpand,
    data: expanded,
    error: expandError,
    reset: resetExpand,
  } = useExpand(projectId, environmentId);

  const run = (tuple: Tuple) => {
    setAsked(tuple);
    resetExpand();
    runCheck(tuple, {
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Check failed'),
    });
    runExpand({ relation: tuple.relation, object: tuple.object });
  };

  return { asked, result, expanded, expandError, isPending, run };
}

function Debugger({ projectId, environment }: { projectId: string; environment: Environment }) {
  const schema = useLatestSchema(projectId, environment.id);
  const shape = useSchemaShape(projectId, environment.id);
  const [tuple, setTuple] = useTupleDraft(shape.sample);
  const decision = useDecisionRun({ projectId, environmentId: environment.id });

  const onSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    decision.run(tuple);
  };

  if (schema.error) return <QueryError error={schema.error} />;

  if (!schema.isPending && !schema.data) {
    return <NoSchemaGuide projectId={projectId} action="check against" />;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <RunCheckCard
        tuple={tuple}
        shape={shape}
        isPending={decision.isPending}
        onTupleChange={setTuple}
        onSubmit={onSubmit}
      />
      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckResult
            result={decision.result}
            expanded={decision.expanded}
            expandError={decision.expandError}
            asked={decision.asked}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function RunCheckCard({
  tuple,
  shape,
  isPending,
  onTupleChange,
  onSubmit,
}: {
  tuple: Tuple;
  shape: SchemaShape;
  isPending: boolean;
  onTupleChange: (tuple: Tuple) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run a check</CardTitle>
        <CardDescription>Ask the engine a single authorization question.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TupleFields idPrefix="debug" tuple={tuple} onChange={onTupleChange} shape={shape} />
          <Button type="submit" disabled={isPending || !isComplete(tuple)}>
            {isPending ? <Spinner /> : <PlayIcon />}
            Run check
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DecisionSummary({ allowed, asked }: { allowed: boolean; asked: Tuple | null }) {
  return (
    <div className={cn('flex items-center gap-3', allowed ? 'text-allowed' : 'text-denied')}>
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full',
          allowed ? 'bg-allowed/10' : 'bg-denied/10',
        )}
      >
        {allowed ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}
      </span>
      <div>
        <div className="font-mono text-lg font-semibold">{allowed ? 'allowed' : 'denied'}</div>
        {asked && (
          <div className="font-mono text-xs text-muted-foreground">
            {asked.user} · {asked.relation} · {asked.object}
          </div>
        )}
      </div>
    </div>
  );
}

function ResolutionPath({ tree, asked }: { tree: ExpandTreeNode | null; asked: Tuple | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        Resolution path ({asked?.relation} on {asked?.object})
      </p>
      <div className="overflow-x-auto rounded-lg bg-muted p-3">
        <ProofTree tree={tree} />
      </div>
    </div>
  );
}

function CheckResult({
  result,
  expanded,
  expandError,
  asked,
}: {
  result: { allowed: boolean } | undefined;
  expanded: { tree: ExpandTreeNode | null } | undefined;
  expandError: Error | null;
  asked: Tuple | null;
}) {
  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Run a check to see the decision for this environment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <DecisionSummary allowed={result.allowed} asked={asked} />
      {expanded && <ResolutionPath tree={expanded.tree} asked={asked} />}
      {expandError && <QueryError error={expandError} />}
    </div>
  );
}
