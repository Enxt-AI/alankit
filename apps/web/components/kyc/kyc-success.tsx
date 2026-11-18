import React from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KycSuccessProps {
  countdown?: number;
}

export function KycSuccess({ countdown }: KycSuccessProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center py-12">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className={cn(
            'w-24 h-24 rounded-full bg-green-100 flex items-center justify-center',
            'animate-in zoom-in-50 duration-500'
          )}>
            <CheckCircle className="w-16 h-16 text-green-600 animate-in zoom-in-75 duration-700" />
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-ping opacity-20" />
        </div>
      </div>
      
      <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        KYC Verified Successfully!
      </h2>
      
      <p className="text-lg text-gray-600 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
        You can now start trading unlisted stocks
      </p>
      
      {countdown !== undefined && countdown > 0 && (
        <p className="text-sm text-gray-500 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Redirecting to dashboard in {countdown} seconds...
        </p>
      )}

      <div className="mt-8 flex justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-green-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
