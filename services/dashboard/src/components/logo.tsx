import { ShieldCheck } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="size-9" />
      <span className="text-3xl font-semibold tracking-tight">Peretyn</span>
    </div>
  );
}
