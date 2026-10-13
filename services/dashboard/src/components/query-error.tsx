import { Callout } from '@/components/callout';

export function QueryError({ error }: { error: Error & { error?: { message?: string } } }) {
  return (
    <Callout>
      <p className="font-medium">Couldn&apos;t load this</p>
      <p>{error.error?.message ?? error.message}</p>
    </Callout>
  );
}
