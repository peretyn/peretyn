import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { execa, type Result } from 'execa';
import type { PeretynClient } from '@peretyn/sdk';
import type { ServiceProcess } from './runtime-process.js';
import { createDevelopmentKey, startControl, stopControl } from './control-process.js';
import { connectClient } from './client.js';

const GO_CLI_DIR = resolve(import.meta.dirname, '../../go-cli');
const TRANSCRIPT_FILE = resolve(import.meta.dirname, '../results/apply-destructive.log');
const CONTROL_PORT = 13001;

const runtimeUrl = inject('runtimeUrl');
const runtimeInternalUrl = inject('runtimeInternalUrl');
const databaseUrl = inject('databaseUrl');

const ALICE_OWNS_ROADMAP = {
  subject: { type: 'user', id: 'alice' },
  relation: 'owner',
  object: { type: 'document', id: 'roadmap' },
};

function documentModel(ownerRelation: string) {
  return {
    model: {
      schema_version: '1.1',
      type_definitions: [
        { type: 'user' },
        {
          type: 'document',
          relations: { [ownerRelation]: { this: {} } },
          metadata: {
            relations: { [ownerRelation]: { directly_related_user_types: [{ type: 'user' }] } },
          },
        },
      ],
    },
    dsl: `model\n  schema 1.1\ntype user\ntype document\n  relations\n    define ${ownerRelation}: [user]`,
  };
}

let control: ServiceProcess | undefined;
let workDir: string;
let cliBinary: string;
let token: string;
let client: PeretynClient;
const transcript: string[] = [];

async function peretyn(args: string[]): Promise<Result> {
  const result = await execa(cliBinary, args, {
    cwd: workDir,
    env: { PERETYN_TOKEN: token, PERETYN_CONTROL_URL: control!.url },
    reject: false,
  });
  transcript.push(
    `$ peretyn ${args.join(' ')}\n${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}\n[exit ${result.exitCode}]\n`,
  );
  return result;
}

async function writeModelFile(name: string, ownerRelation: string): Promise<string> {
  await writeFile(join(workDir, name), JSON.stringify(documentModel(ownerRelation)));
  return name;
}

async function aliceOwnsRoadmap(): Promise<boolean> {
  const { allowed } = await client.check(ALICE_OWNS_ROADMAP);
  return allowed;
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'peretyn-apply-e2e-'));
  cliBinary = join(workDir, 'peretyn');
  await execa('go', ['build', '-o', cliBinary, '.'], { cwd: GO_CLI_DIR, env: { GOWORK: 'off' } });
  control = await startControl({ databaseUrl, runtimeInternalUrl, port: CONTROL_PORT });
  token = await createDevelopmentKey(control.url, 'apply-e2e');
  client = connectClient({ token, baseUrl: runtimeUrl });
}, 180_000);

afterAll(async () => {
  await stopControl(control);
  await mkdir(resolve(TRANSCRIPT_FILE, '..'), { recursive: true });
  await writeFile(TRANSCRIPT_FILE, transcript.join('\n'));
  await rm(workDir, { recursive: true, force: true });
});

describe('peretyn apply', () => {
  it('publishes a first model', async () => {
    const result = await peretyn([
      'apply',
      '--model',
      await writeModelFile('v1.json', 'owner'),
      '--label',
      'v1',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('+ type document');
    await client.write({ writes: [ALICE_OWNS_ROADMAP] });
    expect(await aliceOwnsRoadmap()).toBe(true);
  });

  it('plan marks a renamed relation as a removal and suggests --allow-destructive', async () => {
    const result = await peretyn([
      'plan',
      '--model',
      await writeModelFile('v2.json', 'ownerx'),
      '--label',
      'v2',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('- owner');
    expect(result.stdout).toContain('Checks stop counting the tuples stored under them.');
    expect(result.stdout).toContain('run: peretyn apply --label v2 --allow-destructive');
  });

  it('refuses a model that removes a relation and keeps the live model', async () => {
    const result = await peretyn(['apply', '--model', 'v2.json', '--label', 'v2']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('This model removes document#owner.');
    expect(result.stderr).toContain('--allow-destructive');
    expect(await aliceOwnsRoadmap()).toBe(true);
  });

  it('publishes the removal with --allow-destructive', async () => {
    const result = await peretyn([
      'apply',
      '--model',
      'v2.json',
      '--label',
      'v2',
      '--allow-destructive',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✓ applied "v2"');
  });
});
