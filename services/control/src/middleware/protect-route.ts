import { StatusCodes } from 'http-status-codes';
import { createMiddleware } from 'hono/factory';
import { auth } from '../auth.js';

export type AuthVariables = {
  user: typeof auth.$Infer.Session.user;
  session: typeof auth.$Infer.Session.session;
};

export const protectRoute = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionData) {
    return c.json({ message: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
  }

  c.set('user', sessionData.user);
  c.set('session', sessionData.session);

  await next();
});
