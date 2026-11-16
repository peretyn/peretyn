import { UMAMI_COLLECT_URL, UMAMI_TRACKER_URL } from './umami';

export type Send = typeof fetch;

const BAD_GATEWAY = 502;
const TRACKER_CACHE_CONTROL = 'public, max-age=86400';
const JAVASCRIPT_CONTENT_TYPE = 'application/javascript; charset=utf-8';
const JSON_CONTENT_TYPE = 'application/json';
const SESSION_CACHE_HEADER = 'x-umami-cache';

function badGateway(reason: string, error: unknown): Response {
  console.error(`peretyn docs: ${reason}`, error);
  return new Response(null, { status: BAD_GATEWAY });
}

function firstForwardedAddress(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor === null) return undefined;
  return forwardedFor.split(',')[0]?.trim() || undefined;
}

export function collectHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': JSON_CONTENT_TYPE,
    'user-agent': request.headers.get('user-agent') ?? '',
  };
  const visitorAddress = firstForwardedAddress(request);
  if (visitorAddress !== undefined) headers['true-client-ip'] = visitorAddress;
  const sessionCache = request.headers.get(SESSION_CACHE_HEADER);
  if (sessionCache !== null) headers[SESSION_CACHE_HEADER] = sessionCache;
  return headers;
}

async function fetchTrackerScript(send: Send): Promise<string> {
  const upstream = await send(UMAMI_TRACKER_URL);
  if (!upstream.ok) throw new Error(`Umami tracker answered ${upstream.status}.`);
  return upstream.text();
}

export async function relayTrackerScript(send: Send = fetch): Promise<Response> {
  try {
    return new Response(await fetchTrackerScript(send), {
      headers: { 'content-type': JAVASCRIPT_CONTENT_TYPE, 'cache-control': TRACKER_CACHE_CONTROL },
    });
  } catch (error) {
    return badGateway('the analytics tracker could not be fetched.', error);
  }
}

export async function relayCollect(request: Request, send: Send = fetch): Promise<Response> {
  try {
    const upstream = await send(UMAMI_COLLECT_URL, {
      method: 'POST',
      headers: collectHeaders(request),
      body: await request.text(),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? JSON_CONTENT_TYPE },
    });
  } catch (error) {
    return badGateway('an analytics event could not be relayed.', error);
  }
}
