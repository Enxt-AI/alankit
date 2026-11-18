/**
 * Confirmation dialog for rollback operations
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
import { ContentVersion } from "@/types/content";
import { Loader2 } from "lucide-react";

interface RollbackConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  version: ContentVersion | null;
  isLoading: boolean;
  entityType: string;
  entityName?: string;
}

export function RollbackConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  version,
  isLoading,
  entityType,
  entityName,
}: RollbackConfirmationDialogProps) {
  if (!version) return null;

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case "STATIC_PAGE":
        return "static page";
      case "NEWS":
        return "news article";
      case "ARTICLE":
        return "article post";
      case "FAQ":
        return "FAQ";
      case "STOCK":
        return "stock";
      default:
        return "entity";
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Rollback to Version {version.versionNumber}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to rollback this{" "}
            {getEntityTypeLabel(entityType)}
            {entityName ? ` "${entityName}" ` : " "}
            to version {version.versionNumber}?
            <br />
            <br />
            <strong>This action will:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Create a new version with the current state</li>
              <li>
                Replace the current content with version {version.versionNumber}
              </li>
              <li>Cannot be undone</li>
            </ul>
            <br />
            <span className="text-amber-600">
              Please review the changes carefully before proceeding.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rolling back...
              </>
            ) : (
              "Confirm Rollback"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
