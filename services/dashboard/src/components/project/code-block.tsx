import { CopyButton } from '@/components/copy-button';

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-12 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <CopyButton value={code} className="absolute top-2 right-2" />
    </div>
  );
}
