import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker (ONLY on the production custom domain)
if ('serviceWorker' in navigator) {
  const isTargetHost = window.location.hostname === 'absen.petrolog.my.id';

  window.addEventListener('load', async () => {
    if (!isTargetHost) {
      // Ensure preview/dev hosts don't keep an old SW (prevents stale JS caching issues)
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));

      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.info('✅ SW registered:', registration);

        // Check for updates every 3 minutes
        setInterval(() => {
          registration.update();
        }, 3 * 60 * 1000);

        // Listen for updates - ForceUpdateModal handles the UI notification
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 SW: Update found, installing...');
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ SW: New version installed, ForceUpdateModal will handle notification');
                // Tell service worker to activate immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ SW registration failed:', error);
      });
  });
}
