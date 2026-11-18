'use client';

/**
 * Static Page Delete Dialog Component
 *
 * Confirmation dialog for permanently deleting static pages
 * Performs hard delete (permanently removes from database)
 *
 * Usage:
 * ```tsx
 * <StaticPageDeleteDialog
 *   page={selectedPage}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => console.log('Deleted!')}
 * />
 * ```
 */

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
import { AlertCircle } from 'lucide-react';
import { useDeleteStaticPage } from '@/hooks/use-static-pages';
import type { StaticPage } from '@/types/content';

interface StaticPageDeleteDialogProps {
  page: StaticPage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

export function StaticPageDeleteDialog({
  page,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: StaticPageDeleteDialogProps) {
  // Get delete mutation hook
  const deleteMutation = useDeleteStaticPage(useCmsEndpoint);

  // Handle delete confirmation
  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(page.id);

      // Close dialog and call success callback
      onClose();
      onSuccess?.();
    } catch (error) {
      // Error handling is done in mutation hooks via toast
      console.error('Delete error:', error);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 overflow-hidden max-w-md">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Delete Static Page
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-xs font-medium text-[#64748B] mt-1">
              <p>
                {useCmsEndpoint
                  ? 'This delete request will be sent for admin approval. The page stays live until approved.'
                  : 'Are you sure you want to delete this page? This action cannot be undone.'}
              </p>

              {/* Page Details Card */}
              <div className="rounded-[16px] border border-neutral-200/40 bg-[#FAFBFC] p-4 space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Title</span>
                  <span className="text-xs font-semibold text-[#0F172A] mt-0.5 block">{page.title}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Slug</span>
                  <span className="text-xs font-mono font-semibold text-[#0F172A] mt-0.5 block">{page.slug}</span>
                </div>
              </div>

              {/* Warning Alert */}
              <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50 text-red-800 flex items-start gap-2.5 p-3.5">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <AlertDescription className="text-xs font-semibold leading-relaxed">
                  {useCmsEndpoint
                    ? 'Nothing is deleted yet — the page goes away only after admin approval.'
                    : 'This will permanently delete the page and all its content.'}
                </AlertDescription>
              </Alert>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-3 gap-2 sm:gap-0">
          <AlertDialogCancel 
            disabled={deleteMutation.isPending}
            className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 outline-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="h-10 bg-red-600 text-white border-2 border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600 hover:shadow-[0_8px_20px_rgba(220,38,38,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}