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
import { useDeleteUpcomingStock } from '@/hooks/use-admin-upcoming-stocks';
import type { UpcomingStock } from '@/types/stock';

type UpcomingStockDeleteDialogProps = {
  stock: UpcomingStock | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
};

export function UpcomingStockDeleteDialog({
  stock,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: UpcomingStockDeleteDialogProps) {
  const deleteMutation = useDeleteUpcomingStock(useCmsEndpoint);

  const handleDelete = async () => {
    if (!stock) return;

    try {
      const result: any = await deleteMutation.mutateAsync(stock.id);
      notify.success(useCmsEndpoint ? (result?.message || 'Upcoming stock deletion submitted for admin approval. It stays live until approved.') : 'Upcoming stock permanently deleted');
      onClose();
      onSuccess?.();
    } catch (error: any) {
      notify.error(error.message || 'Failed to delete upcoming stock');
    }
  };

  if (!stock) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open && deleteMutation.isPending) return;
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Upcoming Stock</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to delete the upcoming stock{' '}
                <span className="font-semibold text-foreground">
                  {stock.name} ({stock.cin})
                </span>
                .
              </p>
              {useCmsEndpoint ? (
                <p className="text-amber-600 dark:text-amber-500">
                  This will be sent for admin approval. The upcoming stock stays live until an admin approves the deletion in Approvals.
                </p>
              ) : (
                <>
                  <p className="text-destructive">
                    This will permanently delete the upcoming stock from the database. This action cannot be undone and the stock cannot be recovered.
                  </p>
                  <p className="text-amber-600 dark:text-amber-500">
                    This is a hard delete.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Upcoming Stock'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
