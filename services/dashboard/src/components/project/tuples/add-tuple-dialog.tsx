'use client';

import type { SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@peretyn/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@peretyn/ui/components/dialog';
import { Spinner } from '@peretyn/ui/components/spinner';
import {
  EMPTY_TUPLE,
  isComplete,
  TupleFields,
  useTupleDraft,
} from '@/components/project/tuple-fields';
import { ControlError } from '@/lib/control/client';
import { useSchemaShape } from '@/lib/control/schemas';
import { useAddTuple } from '@/lib/control/tuples';

type AddTupleDialogProps = {
  projectId: string;
  environmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function useAddTupleDialog({
  projectId,
  environmentId,
  onOpenChange,
}: Pick<AddTupleDialogProps, 'projectId' | 'environmentId' | 'onOpenChange'>) {
  const { mutate: addTuple, isPending } = useAddTuple(projectId, environmentId);
  const shape = useSchemaShape(projectId, environmentId);
  const [tuple, setTuple] = useTupleDraft(shape.sample);

  const handleOpenChange = (next: boolean) => {
    if (!next) setTuple(shape.sample ?? EMPTY_TUPLE);
    onOpenChange(next);
  };

  const onSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    addTuple(tuple, {
      onSuccess: () => {
        toast.success('Tuple written');
        handleOpenChange(false);
      },
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Failed to write tuple'),
    });
  };

  return { shape, tuple, setTuple, isPending, handleOpenChange, onSubmit };
}

export function AddTupleDialog({ open, ...dialogProps }: AddTupleDialogProps) {
  const { shape, tuple, setTuple, isPending, handleOpenChange, onSubmit } =
    useAddTupleDialog(dialogProps);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add tuple</DialogTitle>
            <DialogDescription>
              Write a relationship into this environment&apos;s store.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TupleFields idPrefix="add" tuple={tuple} onChange={setTuple} shape={shape} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !isComplete(tuple)}>
              {isPending && <Spinner />}
              Write tuple
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
