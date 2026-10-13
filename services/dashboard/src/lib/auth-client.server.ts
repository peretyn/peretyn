import 'server-only';
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const serverAuthClient = createAuthClient({
  baseURL: process.env.PERETYN_CONTROL_URL ?? 'http://localhost:3001',
  plugins: [organizationClient()],
});
