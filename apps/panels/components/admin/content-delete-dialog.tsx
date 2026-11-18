"use client";

/**
 * Content Delete Dialog Component
 *
 * Reusable confirmation dialog for permanently deleting news articles or article posts
 * Performs hard delete (permanently removes from database)
 *
 * Usage:
 * ```tsx
 * <ContentDeleteDialog
 *   contentType="news"
 *   content={selectedNews}
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
} from "@/components/ui/alert-dialog";
import { useDeleteNews, useDeleteArticle } from "@/hooks/use-admin-content";
import type { News, Article } from "@/types/content";

interface ContentDeleteDialogProps {
  contentType: "news" | "article";
  content: News | Article;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

export function ContentDeleteDialog({
  contentType,
  content,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: ContentDeleteDialogProps) {
  // Get delete mutation hooks
  const deleteNewsMutation = useDeleteNews(useCmsEndpoint);
  const deleteArticleMutation = useDeleteArticle(useCmsEndpoint);

  // Determine loading state - only track the mutation that corresponds to current contentType
  const isLoading =
    contentType === "news"
      ? deleteNewsMutation.isPending
      : deleteArticleMutation.isPending;

  // Handle delete confirmation
  const handleConfirm = async () => {
    try {
      // Conditionally call the appropriate delete mutation based on contentType
      if (contentType === "news") {
        await deleteNewsMutation.mutateAsync(content.id);
      } else {
        await deleteArticleMutation.mutateAsync(content.id);
      }

      // Close dialog and call success callback
      onClose();
      onSuccess?.();
    } catch (error) {
      // Error handling is done in mutation hooks via toast
      console.error("Delete error:", error);
    }
  };

  // Generate dialog content based on contentType
  const contentTypeLabel =
    contentType === "news" ? "news article" : "article post";
  const contentTypeCapitalized = contentType === "news" ? "News" : "Article";

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {contentTypeCapitalized}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the {contentTypeLabel}{" "}
                <span className="font-semibold">"{content.title}"</span>?
              </p>
              {useCmsEndpoint ? (
                <p className="text-sm text-amber-600 font-medium">
                  This will be sent for admin approval. The content stays live
                  until an admin approves the deletion in Approvals.
                </p>
              ) : (
                <p className="text-sm text-destructive font-medium">
                  This action cannot be undone. The content will be permanently
                  removed from the database.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
