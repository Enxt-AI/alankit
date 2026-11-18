"use client";

/**
 * Dashboard Error Boundary
 * 
 * Catches errors specific to dashboard routes
 * Provides navigation to other dashboard pages as recovery options
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Home, LayoutDashboard, Briefcase } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to console
    console.error('Dashboard error:', error);
    
    // TODO: Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Dashboard Error</AlertTitle>
          <AlertDescription>
            We encountered an error while loading the dashboard. Your data is safe.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>What would you like to do?</CardTitle>
          </CardHeader>
          <CardContent>
            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">Error Details (Development):</p>
                <code className="text-xs block whitespace-pre-wrap break-all">
                  {error.message}
                </code>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={reset}
                className="gap-2"
                autoFocus
              >
                Retry
              </Button>
              <Button
                onClick={() => router.push('/dashboard/portfolio')}
                variant="outline"
                className="gap-2"
              >
                <Briefcase className="h-4 w-4" />
                Go to Portfolio
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Go to Stocks
              </Button>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
