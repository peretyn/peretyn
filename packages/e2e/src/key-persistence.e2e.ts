import { describe, it, expect, inject, afterAll } from 'vitest';
import { connectClient } from './client.js';
import { startRuntime, stopRuntime, type RuntimeProcess } from './runtime-process.js';

const SECOND_RUNTIME_PORT = 18082;
const SECOND_RUNTIME_INTERNAL_PORT = 18083;

const databaseUrl = inject('databaseUrl');
const token = inject('token');

let secondRuntime: RuntimeProcess | undefined;

afterAll(async () => {
  await stopRuntime(secondRuntime);
});

describe('API keys', () => {
  describe('when another runtime process starts on the same database', () => {
    it('accepts a key it never issued', async () => {
      secondRuntime = await startRuntime({
        databaseUrl,
        port: SECOND_RUNTIME_PORT,
        internalPort: SECOND_RUNTIME_INTERNAL_PORT,
      });
      const client = connectClient({ token, baseUrl: secondRuntime.url });
      const context = await client.me();
      expect(context.environment).toBe('e2e');
    });
  });
});
