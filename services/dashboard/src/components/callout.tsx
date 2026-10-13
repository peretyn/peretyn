import type { ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
      <span className="mt-px shrink-0">
        <TriangleAlertIcon className="size-4" />
      </span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
