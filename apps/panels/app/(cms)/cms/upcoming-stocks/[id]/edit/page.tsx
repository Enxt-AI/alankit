'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { UpcomingStockForm } from '@/components/admin/upcoming-stock-form';
import { useUpcomingStockDetails } from '@/hooks/use-admin-upcoming-stock-details';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function CMSUpcomingStockEditPage() {
  const params = useParams();
  const router = useRouter();
  const stockId = params.id as string;

  const [isOpen, setIsOpen] = useState(true);

  const { data: stock, isLoading, error, refetch } = useUpcomingStockDetails(stockId, true);

  const handleClose = () => {
    setIsOpen(false);
    router.push('/cms/upcoming-stocks');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
        <span className="ml-2 text-sm text-[#64748B] font-medium">Loading upcoming stock...</span>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="space-y-4 py-2">
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50 text-red-800">
          <AlertDescription className="text-sm font-semibold">
            Failed to load upcoming stock: {error?.message ?? 'Not found'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="h-10 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98] outline-none"
          >
            Retry
          </Button>
          <Button 
            onClick={() => router.push('/cms/upcoming-stocks')}
            className="h-10 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98] outline-none"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <UpcomingStockForm
      mode="edit"
      stock={stock}
      isOpen={true}
      onCloseAction={handleClose}
      onSuccessAction={() => router.push('/cms/upcoming-stocks')}
      useCmsEndpoint
      enableConvert
      onConvertedAction={() => router.push('/cms/stocks')}
    />
  );
}
