import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { peretyn, PeretynError, PeretynTimeoutError, PeretynUnavailableError } from './index.js';

const checkArgs = {
  subject: { type: 'user', id: 'alice' },
  relation: 'viewer',
  object: { type: 'document', id: 'd1' },
};

const servers: Server[] = [];

async function serve(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('timeoutMs', () => {
  it('covers reading the response body', async () => {
    const baseUrl = await serve((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"allowed":');
    });
    const client = peretyn({ token: 'tok', baseUrl, timeoutMs: 200 });

    const startedAt = performance.now();
    const err = await client.check(checkArgs).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PeretynTimeoutError);
    expect(err).toBeInstanceOf(PeretynUnavailableError);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});

describe('transport failures', () => {
  it('throw PeretynUnavailableError when the runtime is unreachable', async () => {
    const baseUrl = await serve(() => {});
    const server = servers.pop()!;
    await new Promise((resolve) => server.close(resolve));
    const client = peretyn({ token: 'tok', baseUrl, retryBackoffMs: 1 });

    const err = await client.check(checkArgs).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PeretynUnavailableError);
    expect(err).not.toBeInstanceOf(PeretynTimeoutError);
    expect((err as Error).cause).toBeInstanceOf(Error);
  });

  it('keep HTTP errors as PeretynError', async () => {
    const baseUrl = await serve((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"unknown token"}');
    });
    const client = peretyn({ token: 'tok', baseUrl });

    const err = await client.check(checkArgs).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PeretynError);
    expect(err).not.toBeInstanceOf(PeretynUnavailableError);
    expect((err as PeretynError).status).toBe(401);
  });
});

describe('baseUrl', () => {
  it.each(['not a url', 'localhost:8080', 'ftp://runtime.example.com'])(
    'rejects %j at construction',
    (baseUrl) => {
      const fetch = vi.fn();
      expect(() => peretyn({ token: 'tok', baseUrl, fetch })).toThrow(/baseUrl/);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
