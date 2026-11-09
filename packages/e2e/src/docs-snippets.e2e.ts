import { join, resolve } from 'node:path';
import { execa } from 'execa';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { schemaToOpenFGA, type PeretynSchema } from '@peretyn/sdk';
import { provisionEnvironment } from './runtime-admin.js';

const SNIPPETS_DIR = resolve(import.meta.dirname, '../../../services/docs/snippets');
const ENVIRONMENT_NAME = 'development';

interface ScriptRun {
  script: string;
  output: string;
}

const SNIPPET_RUNS: Record<string, ScriptRun[]> = {
  quickstart: [{ script: 'check.ts', output: 'allowed' }],
  concepts: [{ script: 'check.ts', output: 'allowed' }],
  sdk: [
    { script: 'client.ts', output: ENVIRONMENT_NAME },
    { script: 'write.ts', output: 'wrote 2 tuples' },
    { script: 'check.ts', output: 'allowed' },
    { script: 'assert.ts', output: 'denied' },
    { script: 'batch-check.ts', output: 'alice: allowed\nbob: denied' },
    {
      script: 'lookup.ts',
      output: 'bob can view: roadmap\ncan edit the roadmap: user:alice',
    },
    { script: 'fail-closed.ts', output: 'allowed' },
    { script: 'delete.ts', output: 'denied' },
  ],
};

async function loadSchema(snippet: string): Promise<PeretynSchema> {
  const module = (await import(join(SNIPPETS_DIR, snippet, 'schema.ts'))) as {
    schema: PeretynSchema;
  };
  return module.schema;
}

async function provisionSnippetEnvironment(snippet: string): Promise<string> {
  return provisionEnvironment({
    internalUrl: inject('runtimeInternalUrl'),
    model: schemaToOpenFGA(await loadSchema(snippet)),
    environmentName: ENVIRONMENT_NAME,
  });
}

async function runScript(snippet: string, { script, token }: { script: string; token: string }) {
  const { stdout } = await execa('node', [join(SNIPPETS_DIR, snippet, script)], {
    env: { PERETYN_TOKEN: token, PERETYN_RUNTIME_URL: inject('runtimeUrl') },
  });
  return stdout.trim();
}

describe.each(Object.entries(SNIPPET_RUNS))('the %s docs snippets', (snippet, runs) => {
  let token: string;

  beforeAll(async () => {
    token = await provisionSnippetEnvironment(snippet);
  });

  it.each(runs)('$script prints what the docs say', async ({ script, output }) => {
    expect(await runScript(snippet, { script, token })).toBe(output);
  });
});
