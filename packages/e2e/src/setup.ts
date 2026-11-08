import { existsSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execa } from 'execa';
import type { TestProject } from 'vitest/node';
import { provisionEnvironment } from './runtime-admin.js';
import {
  RUNTIME_BINARY,
  RUNTIME_DIR,
  startRuntime,
  stopRuntime,
  type RuntimeProcess,
} from './runtime-process.js';

const POSTGRES_IMAGE = 'postgres:16-alpine';
const E2E_PORT = 18080;
const E2E_INTERNAL_PORT = 18081;
const E2E_ENVIRONMENT_NAME = 'e2e';

let runtime: RuntimeProcess | undefined;
let postgres: StartedPostgreSqlContainer | undefined;

export async function setup({ provide }: TestProject) {
  if (!existsSync(RUNTIME_BINARY)) {
    await execa('pnpm', ['run', 'build'], { cwd: RUNTIME_DIR });
  }

  postgres = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = postgres.getConnectionUri();
  runtime = await startRuntime({ databaseUrl, port: E2E_PORT, internalPort: E2E_INTERNAL_PORT });

  const token = await provisionEnvironment({
    internalUrl: runtime.internalUrl,
    model: E2E_MODEL,
    environmentName: E2E_ENVIRONMENT_NAME,
  });

  provide('runtimeUrl', runtime.url);
  provide('runtimeInternalUrl', runtime.internalUrl);
  provide('databaseUrl', databaseUrl);
  provide('token', token);
}

export async function teardown() {
  await stopRuntime(runtime);
  await postgres?.stop();
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
