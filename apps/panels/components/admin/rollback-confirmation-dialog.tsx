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

interface RollbackConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  versionNumber: number;
  isLoading?: boolean;
  onConfirm: () => void;
  entityName?: string;
  versionDate?: string;
}

export function RollbackConfirmationDialog({
  isOpen,
  onClose,
  versionNumber,
  isLoading = false,
  onConfirm,
  entityName,
  versionDate,
}: RollbackConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to rollback {entityName ? `'${entityName}'` : 'the selected item'} to version {versionNumber}{versionDate ? ` (${versionDate})` : ''}? This action will create a new version with the current state and restore the content to the selected version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rolling back...
              </>
            ) : (
              'Confirm Rollback'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}