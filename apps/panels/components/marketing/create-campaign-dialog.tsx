'use client';

import { useState, useEffect } from 'react';
import { useCreateCampaign, useUpdateCampaign, type MarketingCampaign } from '@/hooks/use-marketing-stats';
import { type CreateCampaignDto } from '@/lib/marketing-api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Megaphone } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignToEdit?: MarketingCampaign | null;
}

export default function CreateCampaignDialog({
  open,
  onOpenChange,
  campaignToEdit,
}: CreateCampaignDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateCampaignDto>>({
    name: '',
    platform: '',
    budget: undefined,
    startDate: '',
    endDate: '',
    platformCampaignId: '',
    status: 'ACTIVE',
  });

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();

  // Reset form when opened or when campaignToEdit changes
  useEffect(() => {
    if (open) {
      if (campaignToEdit) {
        setFormData({
          name: campaignToEdit.name,
          platform: campaignToEdit.platform,
          budget: campaignToEdit.budget,
          startDate: campaignToEdit.startDate ? new Date(campaignToEdit.startDate).toISOString().split('T')[0] : '',
          endDate: campaignToEdit.endDate ? new Date(campaignToEdit.endDate).toISOString().split('T')[0] : '',
          platformCampaignId: campaignToEdit.platformCampaignId || '',
          status: campaignToEdit.status,
        });
      } else {
        setFormData({
          name: '',
          platform: '',
          budget: undefined,
          startDate: '',
          endDate: '',
          platformCampaignId: '',
          status: 'ACTIVE',
        });
      }
    }
  }, [open, campaignToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.platform) {
      notify.error('Name and Platform are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCampaignDto = {
        name: formData.name,
        platform: formData.platform,
        budget: formData.budget ? Number(formData.budget) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        platformCampaignId: formData.platformCampaignId || undefined,
        status: formData.status as any,
      };

      if (campaignToEdit) {
        await updateMutation.mutateAsync({ campaignId: campaignToEdit.id, data: payload });
        notify.success('Campaign updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        notify.success('Campaign created successfully');
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to save campaign:', error);
      notify.error(error.message || 'Failed to save campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border border-neutral-200/40 bg-white shadow-lg sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><Megaphone className="h-4 w-4" /></span>{campaignToEdit ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">{campaignToEdit ? 'Update budget, dates and status.' : 'Launch a new campaign to track leads and ROI.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Campaign Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Summer Sale 2026"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Platform *</label>
            <Select
              value={formData.platform}
              onValueChange={(val) => setFormData({ ...formData, platform: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="GOOGLE">Google</SelectItem>
                <SelectItem value="TWITTER">Twitter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Platform Campaign ID (Optional)</label>
            <Input
              value={formData.platformCampaignId}
              onChange={(e) => setFormData({ ...formData, platformCampaignId: e.target.value })}
              placeholder="e.g. 1234567890"
            />
            <p className="text-[10px] text-gray-500">Required for webhook matching</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Budget (Optional)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.budget || ''}
              onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || undefined })}
              placeholder="e.g. 5000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date (Optional)</label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date (Optional)</label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          {campaignToEdit && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-lg h-10 px-4 font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-10 px-4 rounded-lg font-semibold bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] transition-all">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {campaignToEdit ? 'Save Changes' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
