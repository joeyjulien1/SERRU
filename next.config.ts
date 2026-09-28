import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder (a stray lockfile in a parent folder would otherwise confuse it).
  turbopack: { root: __dirname },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],
  // lib/db.ts reads the schema at runtime; make sure it ships with every server function on Vercel.
  outputFileTracingIncludes: { '/**': ['./lib/schema.sql'] },
  experimental: {
    // Product photos from phones can be large; the proxy buffers request bodies up to this size.
    proxyClientMaxBodySize: '30mb',
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
