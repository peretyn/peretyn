import { existsSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import type { TestProject } from 'vitest/node';
import {
  E2E_INTERNAL_SECRET,
  RUNTIME_BINARY,
  RUNTIME_DIR,
  startRuntime,
  stopRuntime,
  type RuntimeProcess,
} from './runtime-process.js';

const POSTGRES_IMAGE = 'postgres:16-alpine';
const E2E_PORT = 18080;
const E2E_INTERNAL_PORT = 18081;
const E2E_ENV_UUID = '00000000-0000-0000-0000-000000000001';

let runtime: RuntimeProcess | undefined;
let postgres: StartedPostgreSqlContainer | undefined;

export async function setup({ provide }: TestProject) {
  if (!existsSync(RUNTIME_BINARY)) {
    await execa('pnpm', ['run', 'build'], { cwd: RUNTIME_DIR });
  }

  postgres = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = postgres.getConnectionUri();
  runtime = await startRuntime({ databaseUrl, port: E2E_PORT, internalPort: E2E_INTERNAL_PORT });

  const storeId = await provisionStore(runtime);
  await writeModel(runtime, storeId);

  provide('runtimeUrl', runtime.url);
  provide('databaseUrl', databaseUrl);
  provide('token', await createKey(runtime, storeId));
}

export async function teardown() {
  await stopRuntime(runtime);
  await postgres?.stop();
}

async function internalPost(
  target: RuntimeProcess,
  request: { path: string; body: unknown },
): Promise<unknown> {
  const { path, body } = request;
  const res = await fetch(`${target.internalUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Peretyn-Internal-Secret': E2E_INTERNAL_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Internal API ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

async function provisionStore(target: RuntimeProcess): Promise<string> {
  const resp = (await internalPost(target, {
    path: '/v1/stores',
    body: { name: 'e2e-test-store' },
  })) as { id: string };
  return resp.id;
}

const E2E_MODEL = {
  schema_version: '1.1',
  type_definitions: [
    { type: 'user' },
    {
      type: 'document',
      relations: {
        viewer: { this: {} },
        editor: { this: {} },
        can_read: {
          union: {
            child: [
              { computedUserset: { relation: 'viewer' } },
              { computedUserset: { relation: 'editor' } },
            ],
          },
        },
      },
      metadata: {
        relations: {
          viewer: { directly_related_user_types: [{ type: 'user' }] },
          editor: { directly_related_user_types: [{ type: 'user' }] },
        },
      },
    },
  ],
};

async function writeModel(target: RuntimeProcess, storeId: string): Promise<void> {
  await internalPost(target, {
    path: `/v1/stores/${storeId}/authorization-models`,
    body: E2E_MODEL,
  });
}

async function createKey(target: RuntimeProcess, storeId: string): Promise<string> {
  const resp = (await internalPost(target, {
    path: '/v1/internal/keys',
    body: {
      environmentUuid: E2E_ENV_UUID,
      storeId,
      projectSlug: 'peretyn-e2e',
      environmentName: 'e2e',
    },
  })) as { plaintext: string };
  return resp.plaintext;
}
