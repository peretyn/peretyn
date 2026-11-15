import 'server-only';
import { cache } from 'react';
import type { AuthSettings } from './auth-settings';

const AUTH_SETTINGS_TIMEOUT_MS = 5000;

export const getAuthSettings = cache(async (): Promise<AuthSettings> => {
  const control = process.env.PERETYN_CONTROL_URL ?? 'http://localhost:3001';
  const response = await fetch(`${control}/public/v1/auth-settings`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(AUTH_SETTINGS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`control plane returned ${response.status} for its auth settings`);
  }
  return (await response.json()) as AuthSettings;
});
