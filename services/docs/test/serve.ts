import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import type { TestProject } from 'vitest/node';

const DOCS_PORT = '3199';
const DOCS_URL = `http://localhost:${DOCS_PORT}`;
const STARTUP_ATTEMPTS = 60;
const STARTUP_INTERVAL_MS = 500;

let server: ChildProcess | undefined;

export async function setup({ provide }: TestProject) {
  server = spawn('pnpm', ['exec', 'next', 'start', '--port', DOCS_PORT], { stdio: 'inherit' });
  await waitUntilServing(DOCS_URL);
  provide('docsUrl', DOCS_URL);
}

export function teardown() {
  server?.kill();
}

async function waitUntilServing(url: string): Promise<void> {
  for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt++) {
    if (await isServing(url)) return;
    await sleep(STARTUP_INTERVAL_MS);
  }
  throw new Error(`The docs did not start at ${url}`);
}

async function isServing(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}
