'use client';

/* eslint-disable shadcn/no-inline-styles -- replaces the root layout, so the app stylesheet is not loaded */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1>Something went wrong</h1>
        {error.digest && <code>{error.digest}</code>}
        <button onClick={reset} type="button">
          Try again
        </button>
      </body>
    </html>
  );
}
