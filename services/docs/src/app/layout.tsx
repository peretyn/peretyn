import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';

import './global.css';
import { cn } from '@peretyn/ui/lib/utils';
import {
  ANALYTICS_PROXY_PATH,
  PROXIED_TRACKER_PATH,
  TRACKED_HOSTNAME,
  UMAMI_WEBSITE_ID,
} from '@/lib/analytics/umami';

const fontSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const fontMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { template: '%s · Peretyn Docs', default: 'Peretyn Docs' },
  description: 'Documentation for Peretyn, relationship-based authorization for TypeScript.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans antialiased', fontSans.variable, fontMono.variable)}
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: 'dark' }}>{children}</RootProvider>
        <Script
          src={PROXIED_TRACKER_PATH}
          data-website-id={UMAMI_WEBSITE_ID}
          data-host-url={ANALYTICS_PROXY_PATH}
          data-domains={TRACKED_HOSTNAME}
        />
      </body>
    </html>
  );
}
