import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface KycErrorProps {
  error: Error;
  onRetry: () => void;
}

export function KycError({ error, onRetry }: KycErrorProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center py-12">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load KYC</h2>
      <p className="text-gray-600 mb-6">{error.message || 'Something went wrong. Please try again.'}</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
