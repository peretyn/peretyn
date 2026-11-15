'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { AuthSettings } from '@/lib/auth-settings';

const AuthSettingsContext = createContext<AuthSettings | null>(null);

export function AuthSettingsProvider({
  settings,
  children,
}: {
  settings: AuthSettings;
  children: ReactNode;
}) {
  return <AuthSettingsContext value={settings}>{children}</AuthSettingsContext>;
}

export function useAuthSettings(): AuthSettings {
  const settings = useContext(AuthSettingsContext);
  if (!settings) throw new Error('useAuthSettings must be used inside AuthSettingsProvider');
  return settings;
}
