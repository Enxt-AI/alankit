import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title = 'Error' }: ErrorStateProps) {
  const message = typeof error === 'string' ? error : error.message;
  
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface SuccessStateProps {
  title?: string;
  message: string;
  countdown?: number;
  icon?: React.ReactNode;
}

export function SuccessState({ 
  title = 'Success!', 
  message, 
  countdown, 
  icon 
}: SuccessStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {icon || <CheckCircle className="h-16 w-16 text-green-500" />}
        <h2 className="mt-6 text-2xl font-bold">{title}</h2>
        <p className="mt-4 text-muted-foreground">
          {countdown !== undefined 
            ? message.replace('{countdown}', countdown.toString())
            : message
          }
        </p>
      </CardContent>
    </Card>
  );
}
