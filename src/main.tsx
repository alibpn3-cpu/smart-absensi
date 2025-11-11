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
                
                // Show toast notification with update button (centered and mobile responsive)
                const toastDiv = document.createElement('div');
                toastDiv.innerHTML = `
                  <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 90vw; width: 400px;">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">🎉 Update Tersedia</div>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 12px;">Versi baru aplikasi tersedia. Klik tombol Update untuk mendapatkan fitur terbaru.</div>
                    <button id="update-now-btn" style="background: #3b82f6; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; width: 100%; transition: background 0.2s;">Update Sekarang</button>
                  </div>
                  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;" id="update-backdrop"></div>
                `;
                document.body.appendChild(toastDiv);
                
                // Add hover effect
                const updateBtn = document.getElementById('update-now-btn');
                if (updateBtn) {
                  updateBtn.addEventListener('mouseenter', () => {
                    updateBtn.style.background = '#2563eb';
                  });
                  updateBtn.addEventListener('mouseleave', () => {
                    updateBtn.style.background = '#3b82f6';
                  });
                }
                
                document.getElementById('update-now-btn')?.addEventListener('click', async () => {
                  console.log('🔄 User clicked update, clearing cache and reloading...');
                  
                  // Mark as user-initiated
                  window.postMessage({ type: 'USER_INITIATED_UPDATE' }, '*');
                  
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

    // Reload page when SW takes control (only if user clicked update)
    let refreshing = false;
    let userInitiatedUpdate = false;
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing && userInitiatedUpdate) {
        console.log('🔄 SW: Controller changed, reloading...');
        refreshing = true;
        window.location.reload();
      }
    });
    
    // Allow manual update trigger
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'USER_INITIATED_UPDATE') {
        userInitiatedUpdate = true;
      }
    });
  });
}
