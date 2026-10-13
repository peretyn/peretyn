import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@peretyn/ui'],
  ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' as const }),
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
  async rewrites() {
    const control = process.env.PERETYN_CONTROL_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/auth/:path*',
        destination: `${control}/api/auth/:path*`,
      },
      {
        source: '/manage/:path*',
        destination: `${control}/manage/:path*`,
      },
      {
        source: '/publish/:path*',
        destination: `${control}/publish/:path*`,
      },
    ];
  },
};

export default nextConfig;
