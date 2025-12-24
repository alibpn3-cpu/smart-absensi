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

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 SW: Update found, installing...');
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ SW: New version installed');
                
                // Prevent duplicate prompt
                if (document.getElementById('update-now-btn')) return;
                
                // Show toast notification with update button (centered and mobile responsive)
                const toastDiv = document.createElement('div');
                toastDiv.innerHTML = `
                  <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: white; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); max-width: 90vw; width: 420px;">
                    <div style="font-weight: 700; font-size: 20px; margin-bottom: 12px; color: #1e293b; text-align: center;">
                      🎉 Update v2.1.0
                    </div>
                    
                    <div style="font-size: 14px; color: #475569; margin-bottom: 20px; text-align: left; line-height: 1.6;">
                      <strong style="color: #3b82f6; display: block; margin-bottom: 10px; font-size: 15px;">✨ Fitur Baru:</strong>
                      <ul style="margin: 0; padding-left: 24px; list-style: disc;">
                        <li style="margin-bottom: 6px;">Sistem Lembur/Overtime terpisah</li>
                        <li style="margin-bottom: 6px;">Button In/Out yang lebih jelas</li>
                        <li style="margin-bottom: 6px;">WFO Fast Checkout dengan input manual</li>
                        <li style="margin-bottom: 6px;">Perhitungan jam kerja otomatis</li>
                      </ul>
                    </div>
                    
                    <button id="update-now-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 14px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%; transition: all 0.2s; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                      Update Sekarang
                    </button>
                  </div>
                  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; backdrop-filter: blur(2px);" id="update-backdrop"></div>
                `;
                document.body.appendChild(toastDiv);
                
                // Add hover effect
                const updateBtn = document.getElementById('update-now-btn') as HTMLButtonElement | null;
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
  });
}
