"use client";

/**
 * Offline Fallback Page
 * 
 * Shown when user is offline and tries to access uncached pages
 * Provides clear feedback and recovery options
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, Wifi, Home, CheckCircle2 } from "lucide-react";

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (isOnline) {
      router.push('/dashboard');
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isOnline ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            ) : (
              <WifiOff className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isOnline ? "Connection Restored" : "You're Offline"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOnline ? (
            <>
              <p className="text-center text-muted-foreground">
                Your internet connection is back. Click below to continue.
              </p>
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  onClick={handleRetry}
                  autoFocus
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-muted-foreground">
                It looks like you've lost your internet connection. Some features may not be available.
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">Still Available:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Cached stocks and portfolio data</li>
                  <li>✓ Previously viewed content</li>
                  <li>✓ Basic navigation</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  onClick={handleRetry}
                  disabled
                >
                  Retry
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </>
          )}
          
          <p
            className="text-xs text-center text-muted-foreground pt-4"
            role="status"
            aria-live="polite"
          >
            Network Status: {isOnline ? "Online ✓" : "Offline"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
