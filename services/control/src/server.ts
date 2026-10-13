import { serve } from '@hono/node-server';
import { app } from './app.js';
import { closeDb } from './db/index.js';
import { log } from './lib/log.js';

const DEFAULT_PORT = 3001;

const port = Number(process.env.PERETYN_CONTROL_PORT ?? DEFAULT_PORT);

const server = serve({ fetch: app.fetch, port }, ({ port: bound }) => {
  log('listening', { port: bound });
});

function shutdown(signal: NodeJS.Signals) {
  log('shutting down', { signal });
  server.close(async () => {
    await closeDb();
    log('shut down');
    process.exit(0);
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
