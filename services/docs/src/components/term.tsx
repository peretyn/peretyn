import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@peretyn/ui/components/tooltip';
import { definitionOf } from '@/lib/terms';

interface TermProps {
  name: string;
  children: ReactNode;
}

export function Term({ name, children }: TermProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help font-medium text-ring underline decoration-ring/50 decoration-dotted underline-offset-4"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>{definitionOf(name)}</TooltipContent>
    </Tooltip>
  );
}
