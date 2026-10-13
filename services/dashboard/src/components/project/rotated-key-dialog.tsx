'use client';

import { Button } from '@peretyn/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@peretyn/ui/components/dialog';
import { Callout } from '@/components/callout';
import { KeyReveal } from './key-reveal';

export function RotatedKeyDialog({
  rotatedKey,
  onClose,
}: {
  rotatedKey: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={rotatedKey !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Key rotated</DialogTitle>
          <DialogDescription>The previous key is now invalid.</DialogDescription>
        </DialogHeader>
        <Callout>
          <p className="font-medium">Copy it now.</p>
          <p>It won&apos;t be shown again.</p>
        </Callout>
        {rotatedKey && <KeyReveal label="New API key" value={rotatedKey} />}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
