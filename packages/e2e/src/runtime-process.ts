import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { execa, type Subprocess } from 'execa';

export const RUNTIME_DIR = resolve(import.meta.dirname, '../../../services/runtime');
export const RUNTIME_BINARY = join(RUNTIME_DIR, 'bin/peretyn-runtime');
export const E2E_INTERNAL_SECRET = 'e2e-internal-secret';

const READY_TIMEOUT_MS = 120_000;
const READY_POLL_INTERVAL_MS = 300;

export interface RuntimeProcess {
  url: string;
  internalUrl: string;
  process: Subprocess;
}

export interface RuntimeOptions {
  databaseUrl: string;
  port: number;
  internalPort: number;
}

export async function startRuntime(options: RuntimeOptions): Promise<RuntimeProcess> {
  const runtime = {
    url: `http://localhost:${options.port}`,
    internalUrl: `http://localhost:${options.internalPort}`,
    process: spawnRuntime(options),
  };
  await waitForReady(runtime);
  return runtime;
}

export async function stopRuntime(runtime: RuntimeProcess | undefined): Promise<void> {
  runtime?.process.kill('SIGTERM');
  await runtime?.process;
}

function spawnRuntime(options: RuntimeOptions): Subprocess {
  return execa(RUNTIME_BINARY, [], {
    env: {
      PERETYN_RUNTIME_DATABASE_URL: options.databaseUrl,
      PERETYN_RUNTIME_ADDR: `:${options.port}`,
      PERETYN_RUNTIME_INTERNAL_ADDR: `:${options.internalPort}`,
      PERETYN_INTERNAL_SECRET: E2E_INTERNAL_SECRET,
      PERETYN_LOG_LEVEL: 'error',
    },
    reject: false,
  });
}

async function probeHealth(url: string): Promise<{ isReady: boolean; error?: unknown }> {
  try {
    const res = await fetch(`${url}/healthz`);
    return { isReady: res.ok };
  } catch (error) {
    return { isReady: false, error };
  }
}

async function throwIfExited(runtime: Subprocess): Promise<void> {
  const exited = await Promise.race([runtime, sleep(READY_POLL_INTERVAL_MS)]);
  if (!exited) return;
  throw new Error(
    `Runtime exited with code ${exited.exitCode} before it was ready:\n${exited.stderr}`,
  );
}

async function waitForReady(runtime: RuntimeProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    const probe = await probeHealth(runtime.url);
    if (probe.isReady) return;
    lastErr = probe.error ?? lastErr;
    await throwIfExited(runtime.process);
  }
  throw new Error(
    `Runtime at ${runtime.url} not ready after ${READY_TIMEOUT_MS}ms. Last error: ${lastErr}`,
  );
}
