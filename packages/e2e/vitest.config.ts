import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.e2e.ts'],
    globalSetup: ['src/setup.ts'],
    testTimeout: 30_000,
  },
});
