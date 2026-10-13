import Link from 'next/link';
import { FileCodeIcon } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';

export function NoSchemaGuide({ projectId, action }: { projectId: string; action: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish a schema first</CardTitle>
        <CardDescription>
          This environment has no authorization model yet, so there&apos;s nothing to {action}.
          Define your schema as code and deploy it with the peretyn CLI, then come back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}/schema`}>
            <FileCodeIcon />
            Go to schema
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
