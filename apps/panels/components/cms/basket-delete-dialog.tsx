'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeleteAdminBasket } from '@/hooks/use-admin-baskets';
import { useDeleteCMSBasket } from '@/hooks/use-cms-baskets';
import { notify } from '@/components/ui/floating-notification';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { StockBasket } from '@/types/basket';

interface BasketDeleteDialogProps {
  basket: StockBasket | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

export function BasketDeleteDialog({
  basket,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint = true,
}: BasketDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteCmsBasket = useDeleteCMSBasket();
  const deleteAdminBasket = useDeleteAdminBasket();

  // Keep both hook instances mounted so the component can safely switch
  // between Admin and CMS basket flows without violating the Rules of Hooks.
  const deleteBasket = useCmsEndpoint ? deleteCmsBasket : deleteAdminBasket;

  const handleDelete = async () => {
    if (!basket) return;

    setIsDeleting(true);
    try {
      const result: any = await deleteBasket.mutateAsync(basket.id);
      notify.success(useCmsEndpoint ? (result?.message || 'Basket deletion submitted for admin approval. It stays live until approved.') : 'Basket deleted successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      notify.error(error.message || 'Failed to delete basket');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!basket) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 overflow-hidden max-w-md">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Stock Basket
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium text-[#64748B] mt-1">
            {useCmsEndpoint
              ? 'This will be sent for admin approval. The basket stays live until an admin approves the deletion in Approvals.'
              : 'Are you sure you want to delete this basket? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-2">
          {/* Basket Details Card */}
          <div className="rounded-[16px] border border-neutral-200/40 bg-[#FAFBFC] p-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Basket Name</p>
              <p className="text-sm font-bold text-[#0F172A] mt-0.5">{basket.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Category</p>
                <p className="text-xs font-semibold text-[#0F172A] mt-0.5">{basket.category}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</p>
                <p className="text-xs font-semibold text-[#0F172A] mt-0.5">{basket.status}</p>
              </div>
            </div>
          </div>

          {/* Destructive Alert */}
          <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50 text-red-800 flex items-start gap-2.5 p-3.5">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <AlertDescription className="text-xs font-semibold leading-relaxed">
              {useCmsEndpoint
                ? 'Nothing is deleted yet — the basket goes away only after admin approval.'
                : 'This will permanently delete the basket and all its constituent associations.'}
            </AlertDescription>
          </Alert>
        </div>

        <AlertDialogFooter className="pt-3 gap-2 sm:gap-0">
          <AlertDialogCancel 
            disabled={isDeleting}
            className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 outline-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="h-10 bg-red-600 text-white border-2 border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600 hover:shadow-[0_8px_20px_rgba(220,38,38,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Basket'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
