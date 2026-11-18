'use client';

import { useState } from 'react';
import { useDeleteCampaign, type MarketingCampaign } from '@/hooks/use-marketing-stats';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';

interface DeleteCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MarketingCampaign | null;
}

export default function DeleteCampaignDialog({ open, onOpenChange, campaign }: DeleteCampaignDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteMutation = useDeleteCampaign();

  const handleDelete = async () => {
    if (!campaign) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(campaign.id);
      notify.success('Campaign deleted successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to delete campaign:', error);
      notify.error(error.message || 'Failed to delete campaign');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border border-neutral-200/40 bg-white shadow-lg sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200/50">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Delete Campaign
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B] pt-1">
            Are you sure you want to delete <strong className="text-[#0F172A]">{campaign.name}</strong>? This will unlink associated leads and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting} className="h-10 px-4 rounded-lg font-semibold">
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting} className="h-10 px-5 rounded-lg font-semibold">
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
