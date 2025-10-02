const CACHE_NAME = 'smart-zone-absensi-v2.0.1'; // Updated version for auto-update
const urlsToCache = [
  '/',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing new version');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ SW: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ SW: Resources cached');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: Activating new version');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ SW: Claiming clients');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network first strategy for API calls, cache first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Network first for API calls (Supabase)
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone response before caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Cache first for static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Return cached version but update cache in background
          fetch(event.request).then((networkResponse) => {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, networkResponse));
          }).catch(() => {});
          return response;
        }
        // Not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache the new resource
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));
            return networkResponse;
          });
      })
  );
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ SW: Received SKIP_WAITING message');
    self.skipWaiting();
  }
});