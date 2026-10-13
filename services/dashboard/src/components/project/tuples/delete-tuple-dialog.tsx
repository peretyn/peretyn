'use client';

import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@peretyn/ui/components/alert-dialog';
import { Spinner } from '@peretyn/ui/components/spinner';
import { ControlError } from '@/lib/control/client';
import { useDeleteTuple } from '@/lib/control/tuples';
import type { Tuple } from '@/lib/control/types';

type DeleteTupleDialogProps = {
  projectId: string;
  environmentId: string;
  tuple: Tuple | null;
  onOpenChange: (open: boolean) => void;
};

function useConfirmDeleteTuple({
  projectId,
  environmentId,
  tuple,
  onOpenChange,
}: DeleteTupleDialogProps) {
  const { mutate: deleteTuple, isPending } = useDeleteTuple(projectId, environmentId);

  const confirm = () => {
    if (!tuple) return;
    deleteTuple(tuple, {
      onSuccess: () => {
        toast.success('Tuple deleted');
        onOpenChange(false);
      },
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Failed to delete tuple'),
    });
  };

  return { confirm, isPending };
}

export function DeleteTupleDialog(props: DeleteTupleDialogProps) {
  const { tuple, onOpenChange } = props;
  const { confirm, isPending } = useConfirmDeleteTuple(props);

  return (
    <AlertDialog open={Boolean(tuple)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this tuple?</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs">
            {tuple && `${tuple.user} · ${tuple.relation} · ${tuple.object}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {isPending && <Spinner />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
