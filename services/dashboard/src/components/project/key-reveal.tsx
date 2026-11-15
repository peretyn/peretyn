import { useId } from 'react';
import { KeyRoundIcon } from 'lucide-react';

import { Textarea } from '@peretyn/ui/components/textarea';
import { CopyButton } from '@/components/copy-button';

export function KeyReveal({ label, value }: { label: string; value: string }) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRoundIcon className="size-3.5 text-muted-foreground" />
        {label}
      </label>
      <div className="flex items-start gap-2">
        <Textarea
          id={inputId}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-0 font-mono text-xs break-all md:text-xs"
        />
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
    </div>
  );
}
