// Dedicated Web Push service worker (separate from app-shell sw.js)
// Scope: /push-sw.js — only handles push + notificationclick

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Digital Presensi', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Digital Presensi';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || undefined,
    data: { link: payload.link || '/', ...(payload.data || {}) },
    // Force notification to stay visible until user interacts (Android/desktop).
    requireInteraction: payload.requireInteraction !== false,
    renotify: payload.renotify !== false && !!payload.tag,
    silent: false,
    vibrate: payload.vibrate || [200, 100, 200, 100, 200],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Update app badge count (Android Chrome / desktop only; iOS ignores silently)
      try {
        if (payload.badgeCount !== undefined && 'setAppBadge' in self.navigator) {
          await self.navigator.setAppBadge(payload.badgeCount);
        }
      } catch (_) {}
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
