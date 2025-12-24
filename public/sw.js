const APP_VERSION = 'v2.3.0';
const CACHE_NAME = `smart-zone-absensi-${APP_VERSION}`;
const urlsToCache = ['/', '/manifest.json'];

const TARGET_HOSTS = new Set(['absen.petrolog.my.id']);

// Install event - cache minimal shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  const host = self.location.hostname;

  // Do NOT run SW on preview/dev hosts (prevents stale module caching and React hook errors)
  if (!TARGET_HOSTS.has(host)) {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
      })()
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Scripts/styles: network-first (avoid serving stale JS/CSS)
// - Supabase/API: network-first
// - Other assets: cache-first (with background update)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache dev server module URLs
  if (url.searchParams.has('t') || url.searchParams.has('v') || url.pathname.startsWith('/src/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const dest = event.request.destination;
  const isScriptOrStyle = dest === 'script' || dest === 'style' || dest === 'worker';

  const isApi = url.hostname.includes('supabase.co') || url.pathname.includes('/api/');

  if (isScriptOrStyle || isApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for other assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
