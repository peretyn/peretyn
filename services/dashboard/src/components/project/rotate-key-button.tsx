'use client';

import { RotateCwIcon } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@peretyn/ui/components/alert-dialog';
import { Spinner } from '@peretyn/ui/components/spinner';

export function RotateKeyButton({
  environmentName,
  isRotating,
  onRotate,
}: {
  environmentName: string;
  isRotating: boolean;
  onRotate: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={isRotating}>
          {isRotating ? <Spinner /> : <RotateCwIcon />}
          Rotate key
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rotate the {environmentName} key?</AlertDialogTitle>
          <AlertDialogDescription>
            The current key stops working immediately. Anything using it - your app, CI, the CLI -
            will start failing until you deploy the new one. There is no undo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRotate}>Rotate key</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
