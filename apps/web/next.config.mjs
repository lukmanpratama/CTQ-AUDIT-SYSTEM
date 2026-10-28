import { randomUUID } from 'node:crypto';
import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */

// Where the Next.js server forwards /api/* to. The proxy runs on the same machine as the API,
// so it goes through loopback: a LAN address (e.g. a phone hotspot IP) changes or drops and then
// every page lost its API connection. In Docker set API_INTERNAL_URL=http://api:3001.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001';

// Offline PWA (service worker built from src/app/sw.ts into public/sw.js; it also shows the
// CAP browser notifications). Service workers only run on https (https://ctq-audit.nihonesia.online),
// never on the plain-http LAN address.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Only production builds get it: in `next dev` it would cache code that keeps changing
  disable: process.env.NODE_ENV === 'development',
  // Coming back online must not reload the page: an inspector may be in the middle of a form
  reloadOnOnline: false,
  // Static pages kept at install (new revision per build): the fallback for a page never opened
  // offline, the dashboard, and the offline routes of the Inspection / Summary steps
  // (/audit/session/local?id=...), which open any audit, also one started without a connection
  additionalPrecacheEntries: ['/offline', '/dashboard', '/audit/session/local', '/audit/session/local/summary']
    .map(url => ({ url, revision: randomUUID() })),
});

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

export default withSerwist(nextConfig);
