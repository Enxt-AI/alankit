'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VersionHistory } from '@/components/audit/version-history';

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

export function VersionHistoryDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}: VersionHistoryDialogProps) {
  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'STATIC_PAGE':
        return 'Static Page';
      case 'CONTENT':
        return 'Content';
      case 'FAQ':
        return 'FAQ';
      default:
        return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Version History - {getEntityTypeLabel(entityType)}
          </DialogTitle>
          <DialogDescription>
            {entityName ? `Viewing history for "${entityName}"` : 'View and manage version history'}
          </DialogDescription>
        </DialogHeader>

        <VersionHistory
          entityType={entityType}
          entityId={entityId}
          title=""
        />
      </DialogContent>
    </Dialog>
  );
}