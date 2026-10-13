'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@peretyn/ui/components/table';
import { NoSchemaGuide } from '@/components/project/no-schema-guide';
import { QueryError } from '@/components/query-error';
import { useLatestSchema, useSchemaShape } from '@/lib/control/schemas';
import type { Environment, Tuple } from '@/lib/control/types';
import { AddTupleDialog } from './add-tuple-dialog';
import { DeleteTupleDialog } from './delete-tuple-dialog';
import { TupleFilterBar } from './tuple-filter-bar';
import { TuplePager } from './tuple-pager';
import { TupleRows } from './tuple-rows';
import { type TuplePage, useTuplePage } from './use-tuple-page';

function TuplesTable({
  query,
  onDelete,
}: {
  query: TuplePage['query'];
  onDelete: (tuple: Tuple) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Relation</TableHead>
            <TableHead>Object</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TupleRows
            isPending={query.isPending}
            isError={query.isError}
            rows={query.data?.tuples ?? []}
            onDelete={onDelete}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function TuplesHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <CardHeader>
      <CardTitle>Relationship tuples</CardTitle>
      <CardDescription>The relationship data this environment evaluates against.</CardDescription>
      <CardAction>
        <Button size="sm" onClick={onAdd}>
          <PlusIcon />
          Add tuple
        </Button>
      </CardAction>
    </CardHeader>
  );
}

function TuplesCard({
  projectId,
  environmentId,
  tuplePage,
}: {
  projectId: string;
  environmentId: string;
  tuplePage: TuplePage;
}) {
  const shape = useSchemaShape(projectId, environmentId);
  const [addOpen, setAddOpen] = useState(false);
  const [tupleToDelete, setTupleToDelete] = useState<Tuple | null>(null);

  return (
    <Card>
      <TuplesHeader onAdd={() => setAddOpen(true)} />
      <CardContent className="flex flex-col gap-4">
        <TupleFilterBar filters={tuplePage.filters} shape={shape} />
        <TuplesTable query={tuplePage.query} onDelete={setTupleToDelete} />
        <TuplePager {...tuplePage} />
      </CardContent>

      <AddTupleDialog
        projectId={projectId}
        environmentId={environmentId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <DeleteTupleDialog
        projectId={projectId}
        environmentId={environmentId}
        tuple={tupleToDelete}
        onOpenChange={(open) => !open && setTupleToDelete(null)}
      />
    </Card>
  );
}

export function Tuples({
  projectId,
  environment,
}: {
  projectId: string;
  environment: Environment;
}) {
  const { data: latest, isPending, error } = useLatestSchema(projectId, environment.id);
  const tuplePage = useTuplePage(projectId, environment.id);

  if (error) return <QueryError error={error} />;

  if (!isPending && !latest) {
    return <NoSchemaGuide projectId={projectId} action="write tuples for" />;
  }

  return <TuplesCard projectId={projectId} environmentId={environment.id} tuplePage={tuplePage} />;
}
