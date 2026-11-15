import { Hono } from 'hono';
import { canDeliverEmail } from '../lib/email.js';
import { isSignUpAllowed } from '../lib/sign-up.js';

export const authSettingsRoute = new Hono().get('/', (c) =>
  c.json({ signUp: isSignUpAllowed, passwordReset: canDeliverEmail }),
);
