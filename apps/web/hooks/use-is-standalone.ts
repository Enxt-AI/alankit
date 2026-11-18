'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect whether the user is running the app inside:
 * 1. An installed PWA (display-mode: standalone / fullscreen / minimal-ui)
 * 2. An iOS Safari Add-to-Home-Screen standalone instance
 * 3. A hybrid wrapper (Capacitor native platform / Android WebView bridge)
 * 4. An Android TWA for this specific application
 *
 * Returns:
 * - isStandalone: true if running inside PWA or native app wrapper, false in standard browser tabs.
 * - isMounted: true once the client-side hydration has executed.
 */
export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === 'undefined') return;

    // 1. True PWA Standalone display modes (installed PWA)
    const isPwa =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true;

    // 2. Native Capacitor wrapper
    const isCapacitor =
      typeof (window as any).Capacitor !== 'undefined' &&
      typeof (window as any).Capacitor.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    // 3. Android native WebView bridge (if used)
    const isAndroidBridge = typeof (window as any).Android !== 'undefined';

    // 4. Strict TWA check (only for your specific app package, NOT all android apps)
    const isTwa =
      typeof document !== 'undefined' &&
      typeof document.referrer === 'string' &&
      document.referrer.startsWith('android-app://com.unlistedstox.app');

    if (isPwa || isCapacitor || isAndroidBridge || isTwa) {
      setIsStandalone(true);
    }
  }, []);

  return { isStandalone, isMounted };
}

