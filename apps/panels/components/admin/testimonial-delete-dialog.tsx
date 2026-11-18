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
import { Loader2 } from 'lucide-react';
import { Testimonial } from '@/types/testimonial';
import { useDeleteTestimonial } from '@/hooks/use-testimonials';

/**
 * Props for the TestimonialDeleteDialog component.
 *
 * @param testimonial     - The testimonial to delete.
 * @param isOpen          - Whether the confirmation dialog is visible.
 * @param onClose         - Callback to close the dialog.
 * @param onSuccess       - Callback fired after a successful deletion.
 * @param useCmsEndpoint  - When true, the delete goes through the CMS endpoint.
 */
interface TestimonialDeleteDialogProps {
  testimonial: Testimonial;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  useCmsEndpoint?: boolean;
}

/**
 * Confirmation dialog for deleting a testimonial.
 * Shows the testimonial author's name so the admin can verify before confirming.
 */
export function TestimonialDeleteDialog({
  testimonial,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: TestimonialDeleteDialogProps) {
  const deleteMutation = useDeleteTestimonial(useCmsEndpoint);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(testimonial.id);
      onSuccess();
      onClose();
    } catch {
      // Error is handled by the mutation's onError callback (toast)
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Testimonial</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the testimonial by &quot;{testimonial.name}&quot;?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
