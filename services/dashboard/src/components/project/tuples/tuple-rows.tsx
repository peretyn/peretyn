import { Trash2Icon } from 'lucide-react';

import { Badge } from '@peretyn/ui/components/badge';
import { Button } from '@peretyn/ui/components/button';
import { Skeleton } from '@peretyn/ui/components/skeleton';
import { TableCell, TableRow } from '@peretyn/ui/components/table';
import type { Tuple } from '@/lib/control/types';

function EmptyRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function TupleRows({
  isPending,
  isError,
  rows,
  onDelete,
}: {
  isPending: boolean;
  isError: boolean;
  rows: Tuple[];
  onDelete: (tuple: Tuple) => void;
}) {
  if (isPending) {
    return Array.from({ length: 4 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell colSpan={4}>
          <Skeleton className="h-5 w-full" />
        </TableCell>
      </TableRow>
    ));
  }
  if (isError) return <EmptyRow message="Couldn't load tuples." />;
  if (rows.length === 0) return <EmptyRow message="No tuples match these filters." />;
  return rows.map((tuple) => (
    <TableRow key={`${tuple.user}|${tuple.relation}|${tuple.object}`}>
      <TableCell className="font-mono">{tuple.user}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-mono">
          {tuple.relation}
        </Badge>
      </TableCell>
      <TableCell className="font-mono">{tuple.object}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" title="Delete tuple" onClick={() => onDelete(tuple)}>
          <Trash2Icon className="text-muted-foreground" />
          <span className="sr-only">Delete tuple</span>
        </Button>
      </TableCell>
    </TableRow>
  ));
}
