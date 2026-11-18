"use client";

/**
 * PWA Install Prompt Component
 * 
 * Detects if app is installable and prompts user to install
 * Shows after user engagement with 7-day dismissal cooldown
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      
      // Show prompt after 30 seconds of engagement
      setTimeout(() => {
        setIsVisible(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('App installed successfully!');
        setIsVisible(false);
      } else {
        handleDismiss();
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Install prompt error:', error);
      console.error('Failed to install app');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isInstallable || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">
      <Card className="border-2 border-primary shadow-lg">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Install Unlisted Stox</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Install our app for a better experience. Access stocks offline and get instant updates.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>✓ Faster loading</li>
            <li>✓ Offline access</li>
            <li>✓ Native app experience</li>
          </ul>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleInstall}
            className="flex-1 gap-2"
            autoFocus
          >
            <Download className="h-4 w-4" />
            Install
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
          >
            Not Now
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
