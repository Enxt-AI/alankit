'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Dev safety: if a SW was previously registered on localhost (e.g. from a prod run),
    // it can cache stale /_next chunks and cause random ChunkLoadError.
    if (process.env.NODE_ENV !== 'production') {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();

          if (registrations.length > 0) {
            await Promise.all(registrations.map((r) => r.unregister()));
          }

          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys.filter((k) => k.startsWith('smc-')).map((k) => caches.delete(k)),
            );
          }

          // If a SW was controlling this page, a reload is needed to fully detach it.
          if (navigator.serviceWorker.controller) {
            const win = window as unknown as Record<string, unknown>;
            const reloadKey = '__smc_sw_dev_cleanup_reloaded__';
            if (!win[reloadKey]) {
              win[reloadKey] = true;
              window.location.reload();
            }
          }
        } catch (error) {
          console.warn('[PWA] Dev SW cleanup failed:', error);
        }
      })();

      return;
    }

    let updateCheckInterval: NodeJS.Timeout;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New service worker available, dispatch custom event
              console.log('[PWA] New service worker available');
              window.dispatchEvent(
                new CustomEvent('swUpdateFound', { detail: registration }),
              );
            }
          });
        });

        // Check for updates periodically
        updateCheckInterval = setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });

    // Cleanup interval on unmount
    return () => {
      if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
      }
    };
  }, []);

  return null;
}
