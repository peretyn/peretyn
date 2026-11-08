import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@peretyn/ui'],
  ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' as const }),
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
};

export default withMDX(nextConfig);
