import { describe, expect, it } from 'vitest';
import { collectHeaders, relayCollect, relayTrackerScript, type Send } from './proxy';

const BAD_GATEWAY = 502;

function answering(response: Response): Send {
  return async () => response;
}

const failing: Send = async () => {
  throw new Error('network down');
};

function collectRequest(headers: Record<string, string>): Request {
  return new Request('https://docs.peretyn.dev/insights/api/send', {
    method: 'POST',
    headers,
    body: '{"type":"event"}',
  });
}

describe('the analytics proxy', () => {
  it('passes the visitor address to Umami as True-Client-IP', () => {
    const headers = collectHeaders(
      collectRequest({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2', 'user-agent': 'Firefox' }),
    );
    expect(headers).toMatchObject({ 'true-client-ip': '203.0.113.7', 'user-agent': 'Firefox' });
  });

  it('relays the event body and passes the answer back', async () => {
    let relayedBody: unknown;
    const send: Send = async (_url, init) => {
      relayedBody = init?.body;
      return new Response('{"sessionId":"s"}', { status: 200 });
    };

    const response = await relayCollect(collectRequest({}), send);

    expect(relayedBody).toBe('{"type":"event"}');
    expect(await response.text()).toBe('{"sessionId":"s"}');
  });

  it('serves the tracker script as cacheable JavaScript', async () => {
    const response = await relayTrackerScript(answering(new Response('tracker();')));
    expect(await response.text()).toBe('tracker();');
    expect(response.headers.get('content-type')).toMatch(/javascript/);
  });

  it('answers 502 when Umami cannot be reached', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      expect((await relayTrackerScript(failing)).status).toBe(BAD_GATEWAY);
      expect((await relayCollect(collectRequest({}), failing)).status).toBe(BAD_GATEWAY);
    } finally {
      console.error = originalError;
    }
  });
});
