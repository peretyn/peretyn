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
import { Badge } from '@peretyn/ui/components/badge';
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

function useKeyRotation(projectId: string, environmentId: string) {
  const { mutate: rotate, isPending: isRotating } = useRotateKey(projectId, environmentId);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  const onRotate = () =>
    rotate(undefined, {
      onSuccess: (result) => setRotatedKey(result.plaintext),
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Failed to rotate key'),
    });

  return { isRotating, onRotate, rotatedKey, clearRotatedKey: () => setRotatedKey(null) };
}

function ApiKeyTitle({ environment }: { environment: Environment }) {
  return (
    <CardTitle className="flex items-center gap-2">
      API key
      <Badge variant={environment.isProduction ? 'default' : 'secondary'}>
        {environmentLabelOf(environment)}
      </Badge>
    </CardTitle>
  );
}

function environmentLabelOf(environment: Environment): string {
  return environment.isProduction ? 'Production' : 'Development';
}

function ApiKey({ projectId, environment }: { projectId: string; environment: Environment }) {
  const { data: key, error } = useEnvironmentKey(projectId, environment.id);
  const { isRotating, onRotate, rotatedKey, clearRotatedKey } = useKeyRotation(
    projectId,
    environment.id,
  );

  return (
    <Card>
      <CardHeader>
        <ApiKeyTitle environment={environment} />
        <CardDescription>
          Each environment has its own key, with no expiry. Switch environments at the top right.
          Rotating replaces the key immediately, and the new key is shown once.
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
          The full key is shown only when the project is created or the key is rotated. If you lost
          it, rotate the key to get a new one.
        </p>
      </CardContent>

      <RotatedKeyDialog
        environmentLabel={environmentLabelOf(environment)}
        rotatedKey={rotatedKey}
        onClose={clearRotatedKey}
      />
    </Card>
  );
}
