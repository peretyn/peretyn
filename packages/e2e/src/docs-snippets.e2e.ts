import { extname, join, resolve } from 'node:path';
import { execa } from 'execa';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { schemaToOpenFGA, type PeretynSchema } from '@peretyn/sdk';
import { provisionEnvironment } from './runtime-admin.js';

const SNIPPETS_DIR = resolve(import.meta.dirname, '../../../services/docs/snippets');
const ENVIRONMENT_NAME = 'development';
const SHELL_SCRIPT_EXTENSION = '.sh';

interface ScriptRun {
  script: string;
  output: string;
}

const SNIPPET_RUNS: Record<string, ScriptRun[]> = {
  quickstart: [{ script: 'check.ts', output: 'allowed' }],
  concepts: [{ script: 'check.ts', output: 'allowed' }],
  roles: [
    { script: 'assign.ts', output: 'assigned 9 tuples' },
    {
      script: 'check.ts',
      output: [
        'ada can_manage project:billing: allowed',
        'root can_manage project:docs: allowed',
        'grace can_view project:billing: allowed',
        'linus can_edit project:billing: denied',
        'sam can_view project:docs: allowed',
        'sam can_edit project:docs: denied',
      ].join('\n'),
    },
    {
      script: 'share.ts',
      output: 'mary can_view project:billing: allowed\nmary can_view project:docs: denied',
    },
    { script: 'lookup.ts', output: 'mary can view: billing' },
  ],
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
  http: [
    { script: 'write.sh', output: '{}' },
    { script: 'check.sh', output: '{"allowed":true,"resolution":""}' },
    { script: 'list-objects.sh', output: '{"objects":["document:specs"]}' },
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

function isShellScript(script: string): boolean {
  return extname(script) === SHELL_SCRIPT_EXTENSION;
}

function interpreterFor(script: string): string {
  return isShellScript(script) ? 'sh' : 'node';
}

function normalizeOutput(script: string, stdout: string): string {
  const output = stdout.trim();
  return isShellScript(script) ? JSON.stringify(JSON.parse(output)) : output;
}

async function runScript(snippet: string, { script, token }: { script: string; token: string }) {
  const { stdout } = await execa(interpreterFor(script), [join(SNIPPETS_DIR, snippet, script)], {
    env: { PERETYN_TOKEN: token, PERETYN_RUNTIME_URL: inject('runtimeUrl') },
  });
  return normalizeOutput(script, stdout);
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
