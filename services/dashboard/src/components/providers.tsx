'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeProvider, useTheme } from 'next-themes';
import { deleteUserPlugin } from '@/lib/auth/delete-user-plugin';
import { authClient } from '@/lib/auth-client';
import { getQueryClient } from '@/lib/query-client';
import { Toaster } from '@peretyn/ui/components/sonner';
import { organizationPlugin } from '@/lib/auth/organization-plugin';
import { themePlugin } from '@/lib/auth/theme-plugin';
import { TooltipProvider } from '@peretyn/ui/components/tooltip';

import { AuthProvider } from './auth/auth-provider';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = getQueryClient();

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider
            authClient={authClient}
            redirectTo="/"
            navigate={({ to, replace }) => (replace ? router.replace(to) : router.push(to))}
            plugins={[
              deleteUserPlugin({ sendDeleteAccountVerification: true }),
              organizationPlugin(),
              themePlugin({ useTheme }),
            ]}
            Link={Link}
          >
            {children}

            <Toaster />
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
