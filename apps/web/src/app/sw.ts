// Service worker (built by @serwist/next into public/sw.js, served at /sw.js).
// 1. Offline app shell: the app's JS/CSS/icons are precached at install, pages visited are
//    kept for offline use, and a page that was never opened falls back to /offline.
// 2. CAP browser notifications (Web Push from the API's PushService).
// API responses are never cached: inspection data must come from the server (or, from
// stage 3 on, from the app's own offline store), not from a stale HTTP cache.

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Filled in at build time with the list of files to precache
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // First match wins: keep every /api/ call on the network (defaultCache would cache GETs)
    { matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

// ── CAP browser notifications ────────────────────────────────────────────────────

type PushData = { title?: string; body?: string; url?: string; tag?: string };

// A push from the API (PushService.sendToAll): { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data: PushData = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'QDRS — ALERT DEFECT RATE', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
      // Stays on screen until tapped or dismissed (where the platform supports it)
      requireInteraction: true,
      // Not in TypeScript's NotificationOptions yet, but Android browsers use it
      ...({ vibrate: [200, 100, 200] } as NotificationOptions),
    }),
  );
});

// Tap: bring an open CTQ Audit window to the alert's page, or open one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          const focused = await client.focus();
          return focused && 'navigate' in focused ? focused.navigate(url) : focused;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
