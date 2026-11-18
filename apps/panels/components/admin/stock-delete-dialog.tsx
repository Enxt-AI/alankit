'use client';

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
import { notify } from '@/components/ui/floating-notification';
import { useDeleteStock } from '@/hooks/use-admin-stocks';
import { Stock } from '@/types/stock';

type StockDeleteDialogProps = {
  stock: Stock | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
};

export function StockDeleteDialog({
  stock,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: StockDeleteDialogProps) {
  const deleteMutation = useDeleteStock(useCmsEndpoint);

  const handleDelete = async () => {
    if (!stock) return;

    try {
      const result: any = await deleteMutation.mutateAsync(stock.id);
      notify.success(useCmsEndpoint ? (result?.message || 'Stock deletion submitted for admin approval. It stays live until approved.') : 'Stock deleted successfully');
      onClose();
      onSuccess?.();
    } catch (error: any) {
      notify.error(error.message || 'Failed to delete stock');
    }
  };

  if (!stock) return null;

  const handleOpenChange = (open: boolean) => {
    // Prevent closing while request is pending
    if (!open && deleteMutation.isPending) {
      return;
    }
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to delete the stock{' '}
                <span className="font-semibold text-foreground">
                  {stock.name} ({stock.cin})
                </span>
                .
              </p>
              {useCmsEndpoint ? (
                <p className="text-amber-600 dark:text-amber-500">
                  This will be sent for admin approval. The stock stays live until an admin approves the deletion in Approvals.
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-500">
                  This is a soft delete. The stock will be marked as inactive and hidden from users,
                  but can be reactivated later by editing it.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Stock'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
