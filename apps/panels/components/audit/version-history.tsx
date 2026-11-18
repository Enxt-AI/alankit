'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ContentVersion } from '@/types/content';
import { useVersionHistory, useRollbackEntity } from '@/hooks/use-audit';
import { RotateCcw, Eye, Loader2 } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { DiffView } from './diff-view';
import { RollbackConfirmationDialog } from './rollback-confirmation-dialog';

interface VersionHistoryProps {
  entityType: string;
  entityId: string;
  title?: string;
}

const getActionBadgeVariant = (action: ContentVersion['changeType']) => {
  switch (action) {
    case 'CREATE':
      return 'default';
    case 'UPDATE':
      return 'secondary';
    case 'ROLLBACK':
      return 'outline';
    default:
      return 'outline';
  }
};

export function VersionHistory({
  entityType,
  entityId,
  title = 'Version History'
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [versionToRollback, setVersionToRollback] = useState<ContentVersion | null>(null);

  const { data: versions, isLoading } = useVersionHistory(entityType, entityId);
  const rollbackMutation = useRollbackEntity();

  const handleViewVersion = (version: ContentVersion) => {
    setSelectedVersion(version);
  };

  const handleRollbackClick = (version: ContentVersion) => {
    setVersionToRollback(version);
    setShowRollbackDialog(true);
  };

  const handleRollbackConfirm = async () => {
    if (!versionToRollback) return;

    try {
      await rollbackMutation.mutateAsync({
        entityType,
        entityId,
        versionNumber: versionToRollback.versionNumber,
      });
      setShowRollbackDialog(false);
      setVersionToRollback(null);
      setSelectedVersion(null);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const getPreviousVersion = (currentVersion: ContentVersion) => {
    if (!versions) return undefined;
    const currentIndex = versions.findIndex(v => v.id === currentVersion.id);
    return currentIndex < versions.length - 1 ? versions[currentIndex + 1] : undefined;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">No version history found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <TableRow key={version.id}>
                <TableCell>
                  <Badge variant="outline">v{version.versionNumber}</Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(version.createdAt), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{version.createdByEmail}</div>
                    <div className="text-sm text-gray-500">{version.createdByRole}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(version.changeType)}>
                    {version.changeType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewVersion(version)}
                      title="View version details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {version.versionNumber !== versions[0]?.versionNumber && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRollbackClick(version)}
                        title="Rollback to this version"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Version Details Dialog */}
        <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Version {selectedVersion?.versionNumber} Details
              </DialogTitle>
            </DialogHeader>

            {selectedVersion && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {format(new Date(selectedVersion.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                  <div>
                    <span className="font-medium">Action:</span>{' '}
                    <Badge variant={getActionBadgeVariant(selectedVersion.changeType)}>
                      {selectedVersion.changeType}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Admin:</span> {selectedVersion.createdByEmail}
                  </div>
                  <div>
                    <span className="font-medium">Role:</span> {selectedVersion.createdByRole}
                  </div>
                </div>

                <DiffView
                  currentVersion={selectedVersion}
                  previousVersion={getPreviousVersion(selectedVersion)}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Rollback Confirmation Dialog */}
        <RollbackConfirmationDialog
          isOpen={showRollbackDialog}
          onClose={() => setShowRollbackDialog(false)}
          onConfirm={handleRollbackConfirm}
          version={versionToRollback}
          isLoading={rollbackMutation.isPending}
          entityType={entityType}
        />
      </CardContent>
    </Card>
  );
}