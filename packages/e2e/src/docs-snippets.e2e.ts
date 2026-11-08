import { join, resolve } from 'node:path';
import { execa } from 'execa';
import { describe, expect, inject, it } from 'vitest';
import { schemaToOpenFGA, type PeretynSchema } from '@peretyn/sdk';
import { provisionEnvironment } from './runtime-admin.js';

const SNIPPETS_DIR = resolve(import.meta.dirname, '../../../services/docs/snippets');
const SNIPPETS = ['quickstart', 'concepts'];

async function loadSchema(snippet: string): Promise<PeretynSchema> {
  const module = (await import(join(SNIPPETS_DIR, snippet, 'schema.ts'))) as {
    schema: PeretynSchema;
  };
  return module.schema;
}

async function runCheckSnippet(snippet: string): Promise<string> {
  const token = await provisionEnvironment({
    internalUrl: inject('runtimeInternalUrl'),
    model: schemaToOpenFGA(await loadSchema(snippet)),
    environmentName: `docs-${snippet}`,
  });
  const { stdout } = await execa('node', [join(SNIPPETS_DIR, snippet, 'check.ts')], {
    env: { PERETYN_TOKEN: token, PERETYN_RUNTIME_URL: inject('runtimeUrl') },
  });
  return stdout.trim();
}

describe.each(SNIPPETS)('the %s docs snippet', (snippet) => {
  it('applies its schema and prints an allowed verdict', async () => {
    expect(await runCheckSnippet(snippet)).toBe('allowed');
  });
});
