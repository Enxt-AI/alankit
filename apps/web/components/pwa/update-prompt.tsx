'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, X } from 'lucide-react';

/**
 * UpdatePrompt Component
 * 
 * Listens for service worker updates and prompts user to refresh.
 * Prevents mid-session version swaps caused by skipWaiting().
 * 
 * Usage: Include in app/dashboard/layout.tsx near InstallPrompt
 */
export function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Check if there's already a waiting service worker
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setRegistration(reg);
        setShowPrompt(true);
      }
    });

    // Store handler for cleanup
    const handleControllerChange = () => {
      // New SW has taken control, reload to get new version
      if (!showPrompt) {
        window.location.reload();
      }
    };

    // Listen for new service worker taking control
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Listen for update found event (custom event from registration)
    const handleUpdateFound = (event: Event) => {
      const customEvent = event as CustomEvent<ServiceWorkerRegistration>;
      setRegistration(customEvent.detail);
      setShowPrompt(true);
    };

    window.addEventListener('swUpdateFound', handleUpdateFound);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('swUpdateFound', handleUpdateFound);
    };
  }, [showPrompt]);

  const handleRefresh = () => {
    if (registration?.waiting) {
      // Tell the waiting SW to skip waiting and activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowPrompt(false);
    // Reload will happen via controllerchange listener
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // User will get the update on next page load/refresh
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="max-w-sm p-4 shadow-lg border-2 border-blue-500 bg-white dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">
              Update Available
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              A new version of Unlisted Stox is ready. Refresh to get the latest features and improvements.
            </p>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleRefresh}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Refresh Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                className="px-3"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
