'use client';

import { use, useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import { Input } from '@peretyn/ui/components/input';
import { Skeleton } from '@peretyn/ui/components/skeleton';
import { QueryError } from '@/components/query-error';
import { EnvContent } from '@/components/project/env-content';
import { RotatedKeyDialog } from '@/components/project/rotated-key-dialog';
import { RotateKeyButton } from '@/components/project/rotate-key-button';
import { ControlError } from '@/lib/control/client';
import { maskKey, useEnvironmentKey, useRotateKey } from '@/lib/control/environments';
import type { Environment } from '@/lib/control/types';

export default function ApiKeyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <EnvContent projectId={projectId}>
      {(environment) => <ApiKey projectId={projectId} environment={environment} />}
    </EnvContent>
  );
}

function KeyValue({
  error,
  keyValue,
}: {
  error: Error | null;
  keyValue: ReturnType<typeof useEnvironmentKey>['data'];
}) {
  if (error) return <QueryError error={error} />;
  if (keyValue) return <Input readOnly className="font-mono" value={maskKey(keyValue)} />;
  return <Skeleton className="h-9 w-full" />;
}

function ApiKey({ projectId, environment }: { projectId: string; environment: Environment }) {
  const { data: key, error } = useEnvironmentKey(projectId, environment.id);
  const { mutate: rotate, isPending: isRotating } = useRotateKey(projectId, environment.id);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  const onRotate = () =>
    rotate(undefined, {
      onSuccess: (result) => setRotatedKey(result.plaintext),
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Failed to rotate key'),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>API key</CardTitle>
        <CardDescription>
          One opaque key per environment, no expiry. Rotating replaces it immediately; the new key
          is shown once.
        </CardDescription>
        <CardAction>
          <RotateKeyButton
            environmentName={environment.name}
            isRotating={isRotating}
            onRotate={onRotate}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <KeyValue error={error} keyValue={key} />
        <p className="text-sm text-muted-foreground">
          The full key is shown only when the project is created or the key is rotated. Store it
          somewhere safe.
        </p>
      </CardContent>

      <RotatedKeyDialog rotatedKey={rotatedKey} onClose={() => setRotatedKey(null)} />
    </Card>
  );
}
