import { extname, join, resolve } from 'node:path';
import { execa } from 'execa';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { schemaToOpenFGA, type PeretynSchema } from '@peretyn/sdk';
import {
  provisionEmptyEnvironment,
  provisionEnvironment,
  writeModel,
  type ProvisionedEnvironment,
} from './runtime-admin.js';

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

const TUTORIAL_CHAPTERS: Record<string, ScriptRun[]> = {
  'tutorial/01-owners': [
    {
      script: 'share.ts',
      output: [
        'alice can_view document:roadmap: allowed',
        'bob can_view document:roadmap: allowed',
        'carol can_view document:roadmap: denied',
      ].join('\n'),
    },
    {
      script: 'edit.ts',
      output: [
        'bob can_edit document:roadmap: allowed',
        'alice can_edit document:roadmap: allowed',
        'alice can_view document:roadmap: allowed',
      ].join('\n'),
    },
  ],
  'tutorial/02-teams': [
    {
      script: 'share-team.ts',
      output: [
        'carol can_view document:roadmap: allowed',
        'carol can_edit document:roadmap: denied',
        'bob can_edit document:roadmap: allowed',
      ].join('\n'),
    },
    { script: 'join.ts', output: 'erin can_view document:roadmap: allowed' },
    { script: 'brand.ts', output: 'dan can_view document:roadmap: allowed' },
    {
      script: 'leave.ts',
      output: 'carol can_view document:roadmap: denied\nerin can_view document:roadmap: allowed',
    },
  ],
  'tutorial/03-folders': [
    {
      script: 'folder.ts',
      output: [
        'frank can_view document:roadmap: allowed',
        'frank can_edit document:roadmap: denied',
      ].join('\n'),
    },
    {
      script: 'nested.ts',
      output: [
        'frank can_view folder:q3: allowed',
        'frank can_view document:launch-plan: allowed',
      ].join('\n'),
    },
    {
      script: 'move.ts',
      output: [
        'frank can_view document:launch-plan: denied',
        'alice can_view document:launch-plan: allowed',
      ].join('\n'),
    },
  ],
  'tutorial/04-public-links': [
    {
      script: 'publish.ts',
      output: [
        'zoe can_view document:announcement: allowed',
        'zoe can_edit document:announcement: denied',
        'zoe can_view document:roadmap: denied',
      ].join('\n'),
    },
    {
      script: 'unpublish.ts',
      output: [
        'zoe can_view document:announcement: denied',
        'alice can_view document:announcement: allowed',
      ].join('\n'),
    },
  ],
  'tutorial/05-company': [
    {
      script: 'admin.ts',
      output: [
        'ivan can_view document:roadmap: allowed',
        'ivan can_view document:launch-plan: allowed',
        'ivan can_edit document:roadmap: denied',
      ].join('\n'),
    },
    {
      script: 'other-company.ts',
      output: [
        'hana can_view document:roadmap: denied',
        'ivan can_view document:roadmap: allowed',
      ].join('\n'),
    },
  ],
  'tutorial/06-exceptions': [
    {
      script: 'block.ts',
      output: [
        'frank can_view document:team-reviews: denied',
        'frank can_view document:roadmap: allowed',
        'ivan can_view document:team-reviews: allowed',
      ].join('\n'),
    },
    {
      script: 'guests.ts',
      output: [
        'gus can_edit document:roadmap: allowed',
        'gus can_share document:roadmap: denied',
        'bob can_share document:roadmap: allowed',
      ].join('\n'),
    },
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

describe('the tutorial docs snippets, in order against one environment', () => {
  let environment: ProvisionedEnvironment;

  beforeAll(async () => {
    environment = await provisionEmptyEnvironment({
      internalUrl: inject('runtimeInternalUrl'),
      environmentName: ENVIRONMENT_NAME,
    });
  });

  describe.each(Object.entries(TUTORIAL_CHAPTERS))('chapter %s', (chapter, runs) => {
    beforeAll(async () => {
      await writeModel({
        internalUrl: inject('runtimeInternalUrl'),
        storeId: environment.storeId,
        model: schemaToOpenFGA(await loadSchema(chapter)),
      });
    });

    it.each(runs)('$script prints what the docs say', async ({ script, output }) => {
      expect(await runScript(chapter, { script, token: environment.token })).toBe(output);
    });
  });
});
