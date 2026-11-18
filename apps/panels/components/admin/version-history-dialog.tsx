'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentVersion } from '@/types/content';
import { useVersionHistory } from '@/hooks/use-versions';

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
  onRollback?: (versionNumber: number) => void;
  useCmsEndpoint?: boolean;
}

export function VersionHistoryDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  onRollback,
  useCmsEndpoint = false,
}: VersionHistoryDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);

  // Only fetch version history after the dialog opens. This prevents hidden
  // dialogs from triggering unsupported or unnecessary background requests.
  const { data: versions, isLoading } = useVersionHistory(entityType, entityId, useCmsEndpoint, isOpen);

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'STATIC_PAGE':
        return 'Static Page';
      case 'CONTENT':
        return 'Content';
      case 'FAQ':
        return 'FAQ';
      case 'STOCK':
        return 'Stock';
      case 'BASKET':
      case 'STOCK_BASKET':
        return 'Basket';
      default:
        return type;
    }
  };

  const handleViewVersion = (version: ContentVersion) => {
    setSelectedVersion(version);
  };

  const handleRollbackClick = (version: ContentVersion) => {
    if (onRollback) {
      onRollback(version.versionNumber);
    }
  };

  const getPreviousVersion = (currentVersion: ContentVersion) => {
    if (!versions) return undefined;
    const currentIndex = versions.findIndex(v => v.id === currentVersion.id);
    return currentIndex < versions.length - 1 ? versions[currentIndex + 1] : undefined;
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History - {getEntityTypeLabel(entityType)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History - {getEntityTypeLabel(entityType)}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-gray-500 py-8">No version history found</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History for {entityName}</DialogTitle>
          <DialogDescription>
            {entityName ? `Viewing history for "${entityName}"` : 'View and manage version history'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Version List */}
          <div className="space-y-2">
            {versions.map(v => (
              <Card key={v.id} onClick={() => setSelectedVersion(v)} className={selectedVersion?.id === v.id ? 'border-blue-500' : ''}>
                <CardHeader>
                  <CardTitle>Version {v.versionNumber}</CardTitle>
                  <Badge variant={v.changeType === 'CREATE' ? 'default' : v.changeType === 'UPDATE' ? 'secondary' : 'outline'}>{v.changeType}</Badge>
                  <p>{v.createdByEmail} • {new Date(v.createdAt).toLocaleDateString()}</p>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Diff View */}
          {selectedVersion && (
            <div className="md:col-span-2 space-y-4">
              <h3>Changes in Version {selectedVersion.versionNumber}</h3>
              {(() => {
                const prevVersion = getPreviousVersion(selectedVersion);
                if (prevVersion) {
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4>Before</h4>
                        <pre className="bg-gray-100 p-2">{JSON.stringify(prevVersion.content, null, 2)}</pre>
                      </div>
                      <div>
                        <h4>After</h4>
                        <pre className="bg-blue-50 p-2">{JSON.stringify(selectedVersion.content, null, 2)}</pre>
                      </div>
                    </div>
                  );
                }
                return <p>No previous version to compare</p>;
              })()}
              {onRollback && selectedVersion.versionNumber !== (versions[0]?.versionNumber || 0) && (
                <Button onClick={() => handleRollbackClick(selectedVersion)} variant="destructive">
                  Rollback to Version {selectedVersion.versionNumber}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}