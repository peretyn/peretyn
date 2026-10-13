import { createMiddleware } from 'hono/factory';
import { log } from '../lib/log.js';

const SENSITIVE_SEGMENT = /^(reset-password|verify-email)$/;

function redactPath(pathname: string): string {
  const segments = pathname.split('/');
  return segments
    .map((segment, i) =>
      i > 0 && SENSITIVE_SEGMENT.test(segments[i - 1]!) ? '<redacted>' : segment,
    )
    .join('/');
}

export const accessLog = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const { pathname } = new URL(c.req.url);
  log('http', {
    method: c.req.method,
    path: redactPath(pathname),
    status: c.res.status,
    ms: Date.now() - start,
  });
});
