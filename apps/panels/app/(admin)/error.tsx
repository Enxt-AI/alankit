/**
 * Admin Panel Error Boundary
 * 
 * Catches and handles runtime errors in the admin panel.
 * Provides a fallback UI with retry functionality.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary component for admin layout
 * Catches all errors in admin pages and provides recovery options
 */
export default function AdminError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Admin panel error:', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV !== 'production' && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm font-mono">
                {error.message}
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            {process.env.NODE_ENV === 'production' 
              ? 'An unexpected error occurred. Please try again or contact support if the problem persists.'
              : 'Check the console for more details about this error.'}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} variant="default">
            Try Again
          </Button>
          <Button onClick={() => router.push('/admin/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
