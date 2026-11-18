'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, FileCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';


export function DematReminderPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Only show if user has verified KYC but pending demat AND they haven't submitted the form yet
    if (user?.kycStatus !== 'VERIFIED' || user?.dematStatus !== 'PENDING' || (user?.dematData as any)?.submittedAt) {
      return;
    }


    // Show popup after 5-second delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    // Handle Escape key to dismiss
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleLinkDemat = () => {
    router.push('/demat');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 border-2 border-primary/50 shadow-lg">
      <CardHeader className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          <CardTitle>Link Your Demat Account</CardTitle>
        </div>
        <CardDescription>
          Link your demat account to receive allocated stocks in your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You&apos;ve completed KYC verification. Now link your demat account to start receiving stock allocations.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleLinkDemat} className="w-full">
          Link Demat Account
        </Button>
      </CardFooter>
    </Card>
  );
}
