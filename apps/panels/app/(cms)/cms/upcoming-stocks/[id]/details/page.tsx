'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { useUpcomingStockDetails } from '@/hooks/use-admin-upcoming-stock-details';
import { useConvertUpcomingStock } from '@/hooks/use-admin-upcoming-stocks';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { UpcomingBasicInfoTab } from '@/components/cms/upcoming-stock-details/basic-info-tab';

import { ConvertConfirmationDialog } from '@/components/cms/upcoming-stock-details/convert-confirmation-dialog';

export default function UpcomingStockDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { cmsAdmin } = useCMSAuth();
  const stockId = params.id as string;
  const [showConvertConfirmation, setShowConvertConfirmation] = useState(false);

  const hasPermission =
    cmsAdmin?.permissions?.includes('cms_stocks') || cmsAdmin?.role === 'SUPER_ADMIN';

  const { data: stock, isLoading, error, refetch } = useUpcomingStockDetails(stockId, true);
  const convertMutation = useConvertUpcomingStock(true);

  if (!hasPermission) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Upcoming Stock Details</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">Manage upcoming stock information</p>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to access upcoming stock details management. Contact your administrator to enable{' '}
            <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">cms_stocks</code> permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/cms/upcoming-stocks')}
            className="h-10 w-10 border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl flex items-center justify-center transition-all duration-300 ease-in-out active:scale-[0.98] bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              {stock ? `${stock.name} (${stock.cin})` : 'Upcoming Stock Details'}
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">Manage upcoming stock information</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={!stock || isLoading || !!error || convertMutation.isPending}
            onClick={() => setShowConvertConfirmation(true)}
            className="h-10 bg-red-600 hover:bg-white text-white hover:text-red-600 border-2 border-red-600 active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none disabled:opacity-50"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              'Convert to Regular Stock'
            )}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-[24px] border border-neutral-200/40 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)] p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#16A34A] mx-auto mb-4" />
          <p className="text-sm font-medium text-[#64748B]">Loading upcoming stock details...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between text-red-800 w-full">
            <span>Failed to load upcoming stock details: {error.message}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="bg-white border border-red-200 text-red-800 hover:bg-red-100/50 rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stock Details */}
      {!isLoading && !error && stock && (
        <UpcomingBasicInfoTab stock={stock} onUpdate={refetch} />
      )}

      <ConvertConfirmationDialog
        isOpen={showConvertConfirmation}
        onClose={() => setShowConvertConfirmation(false)}
        isLoading={convertMutation.isPending}
        onConfirm={async () => {
          try {
            await convertMutation.mutateAsync(stockId);
            setShowConvertConfirmation(false);
            router.replace('/cms/upcoming-stocks');
          } catch {
            // Error toasts are handled by the mutation hook.
          }
        }}
      />
    </div>
  );
}

