'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRejectUserDemat } from '@/hooks/use-admin-users';
import { notify } from '@/components/ui/floating-notification';

interface DematRejectionDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog component for rejecting Demat linkage with a reason
 */
export function DematRejectionDialog({ userId, open, onOpenChange, onSuccess }: DematRejectionDialogProps) {
  const [reason, setReason] = useState('');
  const rejectMutation = useRejectUserDemat();

  const handleReject = async () => {
    if (!userId) return;

    if (reason.trim().length < 5) {
      notify.error('Rejection reason must be at least 5 characters');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        userId,
        reason: reason.trim(),
      });

      notify.success('Demat linking rejected. User will be notified to re-upload.');

      setReason('');
      onSuccess?.();
    } catch (error: any) {
      notify.error(error.message || 'Failed to reject Demat Account');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reject Demat Document</DialogTitle>
          <DialogDescription>
            Please provide a clear reason for rejecting this Demat statement. The user will see this message and be asked to try again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="demat-reason">Rejection Reason *</Label>
            <Textarea
              id="demat-reason"
              placeholder="e.g., The uploaded document is blurry. Please upload a clear PDF of your latest CMR copy."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 5 characters. Be specific about what needs to be corrected.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={rejectMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={rejectMutation.isPending || reason.trim().length < 5}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Reject Demat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
