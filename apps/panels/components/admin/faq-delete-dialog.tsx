'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { Faq } from '@/types/faq';
import { useDeleteFaq } from '@/hooks/use-admin-faqs';

interface FaqDeleteDialogProps {
  faq: Faq;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  useCmsEndpoint?: boolean;
}

export function FaqDeleteDialog({ faq, isOpen, onClose, onSuccess, useCmsEndpoint }: FaqDeleteDialogProps) {
  const deleteMutation = useDeleteFaq(useCmsEndpoint);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(faq.id);
      onSuccess();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
          <AlertDialogDescription>
            {useCmsEndpoint
              ? `Delete request for FAQ "${faq.title}" will be sent for admin approval. It stays live until approved.`
              : `Are you sure you want to delete the FAQ "${faq.title}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}