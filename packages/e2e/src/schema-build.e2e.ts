import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { execa } from 'execa';
import { provisionEnvironment } from './runtime-admin.js';

const GO_CLI_DIR = resolve(import.meta.dirname, '../../go-cli');
const SDK_DIR = resolve(import.meta.dirname, '../../sdk');
const SCHEMA_FILE = 'schema.ts';
const MODEL_FILE = 'peretyn.model.json';

const runtimeInternalUrl = inject('runtimeInternalUrl');

let workDir: string;
let cliBinary: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'peretyn-build-e2e-'));
  cliBinary = join(workDir, 'peretyn');
  await execa('go', ['build', '-o', cliBinary, '.'], {
    cwd: GO_CLI_DIR,
    env: { GOWORK: 'off' },
  });
  await mkdir(join(workDir, 'node_modules/@peretyn'), { recursive: true });
  await symlink(SDK_DIR, join(workDir, 'node_modules/@peretyn/sdk'));
}, 120_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function build(schemaSource: string, packageType = 'module') {
  await writeFile(join(workDir, 'package.json'), JSON.stringify({ type: packageType }));
  await writeFile(join(workDir, SCHEMA_FILE), schemaSource);
  return execa(cliBinary, ['build', '--schema', SCHEMA_FILE, '--out', MODEL_FILE], {
    cwd: workDir,
    reject: false,
  });
}

async function publishBuiltModel(environmentName: string): Promise<void> {
  const artifact = JSON.parse(await readFile(join(workDir, MODEL_FILE), 'utf8')) as {
    model: unknown;
  };
  await provisionEnvironment({
    internalUrl: runtimeInternalUrl,
    model: artifact.model,
    environmentName,
  });
}

describe('peretyn build', () => {
  describe('fails with a file position and a message in schema terms', () => {
    it('for a relation target of an unknown type', async () => {
      const result = await build(
        [
          "import { defineSchema, type } from '@peretyn/sdk';",
          'export const schema = defineSchema({',
          '  user: type(),',
          "  doc: type({ relations: { owner: ['usr'] } }),",
          '});',
        ].join('\n'),
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'schema.ts:4:37: Peretyn schema: type "doc" relation "owner": "usr" is not a type in the schema',
      );
    });

    it('for a permission that refers to an undefined relation', async () => {
      const result = await build(
        [
          "import { any, defineSchema, type } from '@peretyn/sdk';",
          'export const schema = defineSchema({',
          '  user: type(),',
          '  doc: type({',
          "    relations: { owner: ['user'] },",
          "    permissions: { view: any('owner', 'ghost') },",
          '  }),',
          '});',
        ].join('\n'),
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'schema.ts:6:40: Peretyn schema: type "doc" permission "view": "ghost" is not a relation or permission of "doc"',
      );
    });

    it('for a schema written without defineSchema', async () => {
      const result = await build(
        [
          "import { type } from '@peretyn/sdk';",
          'export const schema = {',
          '  user: type(),',
          "  doc: type({ relations: { viewer: ['team#member'] } }),",
          '};',
        ].join('\n'),
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'schema.ts:4:38: Peretyn schema: type "doc" relation "viewer": "team" is not a type in the schema',
      );
    });

    it('for an ES module schema in a CommonJS package, with the loader error and a hint', async () => {
      const result = await build(
        [
          "import { defineSchema, type } from '@peretyn/sdk';",
          'export const schema = defineSchema({ user: type() });',
        ].join('\n'),
        'commonjs',
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/import statement outside a module|ERR_REQUIRE_ESM/);
      expect(result.stderr).toContain('"type": "module"');
    });
  });

  describe('produces a model the runtime accepts', () => {
    it('for a permission that exposes a single relation with any()', async () => {
      const result = await build(
        [
          "import { any, defineSchema, type } from '@peretyn/sdk';",
          'export const schema = defineSchema({',
          '  user: type(),',
          "  doc: type({ relations: { admin: ['user'] }, permissions: { manage: any('admin') } }),",
          '});',
        ].join('\n'),
      );
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      await expect(publishBuiltModel('single-any')).resolves.toBeUndefined();
    });

    it('for a recursive folder hierarchy', async () => {
      const result = await build(
        [
          "import { any, defineSchema, exclude, type, via } from '@peretyn/sdk';",
          'export const schema = defineSchema({',
          '  user: type(),',
          '  folder: type({',
          "    relations: { parent: ['folder'], viewer: ['user', 'user:*'], blocked: ['user'] },",
          '    permissions: {',
          "      view: any('viewer', via('parent', 'view')),",
          "      read: exclude('view', 'blocked'),",
          '    },',
          '  }),',
          '});',
        ].join('\n'),
      );
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      await expect(publishBuiltModel('folders')).resolves.toBeUndefined();
    });
  });
});
