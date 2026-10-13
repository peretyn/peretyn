import { useId } from 'react';
import { KeyRoundIcon } from 'lucide-react';

import { Input } from '@peretyn/ui/components/input';
import { CopyButton } from '@/components/copy-button';

export function KeyReveal({ label, value }: { label: string; value: string }) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRoundIcon className="size-3.5 text-muted-foreground" />
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input id={inputId} readOnly value={value} className="font-mono text-xs" />
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
    </div>
  );
}
