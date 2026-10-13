import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const serviceRoot = fileURLToPath(new URL('..', import.meta.url));

it('closes the server and the database pool on SIGTERM, then exits cleanly', async () => {
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: serviceRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PERETYN_CONTROL_PORT: '0',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
    },
  });
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk));
  server.stderr.on('data', (chunk) => (output += chunk));

  while (!output.includes('"msg":"listening"')) {
    if (server.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  server.kill('SIGTERM');
  const [code, signal] = await once(server, 'exit');

  expect({ code, signal }).toEqual({ code: 0, signal: null });
  expect(output).toContain('"msg":"shut down"');
}, 20_000);
