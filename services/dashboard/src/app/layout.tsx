import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';

import '@peretyn/ui/globals.css';
import { cn } from '@peretyn/ui/lib/utils';
import { Providers } from '@/components/providers';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Peretyn Dashboard',
  description: 'Peretyn developer dashboard.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('font-sans antialiased', fontSans.variable, fontMono.variable)}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
