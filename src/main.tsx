import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.info('✅ SW registered:', registration);

        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 SW: Update found, installing...');
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ SW: New version installed');
                
                // Show toast notification with update button
                const toastDiv = document.createElement('div');
                toastDiv.innerHTML = `
                  <div style="position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px;">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">🎉 Update Tersedia</div>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 12px;">Versi baru aplikasi tersedia. Klik tombol Update untuk mendapatkan fitur terbaru.</div>
                    <button id="update-now-btn" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; width: 100%;">Update Sekarang</button>
                  </div>
                `;
                document.body.appendChild(toastDiv);
                
                document.getElementById('update-now-btn')?.addEventListener('click', async () => {
                  console.log('🔄 User clicked update, clearing cache and reloading...');
                  
                  // Tell service worker to skip waiting
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // Clear all caches except permissions
                  if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                      cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                  }
                  
                  // Reload after a short delay
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                });
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ SW registration failed:', error);
      });

    // Reload page when SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        console.log('🔄 SW: Controller changed, reloading...');
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
