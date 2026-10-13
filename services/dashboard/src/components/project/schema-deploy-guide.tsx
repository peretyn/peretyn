import type { ReactNode } from 'react';

import { CodeBlock } from '@/components/project/code-block';

const AUTHOR = `// src/schema.ts
import { defineSchema, type, any } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  document: type({
    relations: {
      owner: ['user'],
      editor: ['user'],
    },
    permissions: {
      can_edit: any('owner', 'editor'),
    },
  }),
});`;

const DEPLOY = `# compile the schema to a deployable artifact
peretyn build --schema src/schema.ts

# review what would change, then deploy to this environment
export PERETYN_TOKEN=<this environment's API key>
peretyn plan
peretyn apply --label v1`;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs">
          {n}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

export function SchemaDeployGuide() {
  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="Author your model as code">
        <CodeBlock code={AUTHOR} />
      </Step>
      <Step n={2} title="Compile, then deploy to this environment">
        <CodeBlock code={DEPLOY} />
      </Step>
    </div>
  );
}
