'use client';

import { useEffect } from 'react';
import { Button } from '@peretyn/ui/components/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page failed to render. Trying again is usually enough; if it keeps happening, include
        the reference below when you report it.
      </p>
      {error.digest && (
        <code className="font-mono text-xs text-muted-foreground">{error.digest}</code>
      )}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
