'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import { cn } from '@peretyn/ui/lib/utils';

const COPIED_RESET_DELAY_MS = 1500;

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_DELAY_MS);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn('text-muted-foreground', className)}
        onClick={copy}
        title={label}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span className="sr-only">{label}</span>
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}
