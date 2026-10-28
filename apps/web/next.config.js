/** @type {import('next').NextConfig} */

// Where the Next.js server forwards /api/* to. The proxy runs on the same machine as the API,
// so it goes through loopback: a LAN address (e.g. a phone hotspot IP) changes or drops and then
// every page lost its API connection. In Docker set API_INTERNAL_URL=http://api:3001.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001';

const nextConfig = {
  // NEXT_DIST_DIR=.next-prod lets a production build/start use its own folder, so it can be
  // built while `next dev` is still serving from .next (no downtime while building)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  experimental: {
    allowedDevOrigins: ['localhost:3000', '192.168.43.210:3000', '192.168.43.210'],
    // Default is 30s; a slower report/import request was cut off and showed up as "API unreachable"
    proxyTimeout: 120000,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.43.210:3001',
  },
  async rewrites() {
    return [
      // Proxy API calls in development to avoid CORS
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
