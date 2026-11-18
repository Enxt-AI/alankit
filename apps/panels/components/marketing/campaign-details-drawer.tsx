'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { MarketingCampaign } from '@/lib/marketing-api';
import type { MarketingDashboardStats } from '@/lib/marketing-stats-api';
import { Target, Calendar, DollarSign, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface CampaignDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MarketingCampaign | null;
  stats?: MarketingDashboardStats;
}

const statusConfig: Record<string, string> = {
  ACTIVE: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20',
  PAUSED: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20',
  COMPLETED: 'bg-neutral-50 text-[#64748B] border-neutral-200/60',
};

export default function CampaignDetailsDrawer({ open, onOpenChange, campaign, stats }: CampaignDetailsDrawerProps) {
  if (!campaign) return null;
  const campaignStat = stats?.campaigns.find(c => c.id === campaign.id) as any;
  const leadCount = campaignStat?.leadCount || campaignStat?._count?.leads || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white">
        <SheetHeader className="pb-5 border-b border-neutral-200/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
              <Target className="h-5 w-5" />
            </span>
            <span>
              <SheetTitle className="text-base font-bold text-[#0F172A] text-left">{campaign.name}</SheetTitle>
              <SheetDescription className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] text-left">
                {campaign.platform} Campaign
              </SheetDescription>
            </span>
          </div>
          <div className="flex items-center gap-2 pt-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusConfig[campaign.status] ?? statusConfig.COMPLETED}`}>
              {campaign.status}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-neutral-50 text-[#64748B] border border-neutral-200/60 font-mono">
              #{campaign.id.substring(0, 8)}
            </span>
          </div>
        </SheetHeader>

        <div className="py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-[20px] bg-[#FAFBFC] border border-neutral-200/40">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total Leads</div>
              <div className="mt-0.5 text-2xl font-bold text-[#0F172A] tracking-tight">{leadCount}</div>
            </div>
            <div className="p-4 rounded-[20px] bg-[#FAFBFC] border border-neutral-200/40">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Budget</div>
              <div className="mt-0.5 text-2xl font-bold text-[#0F172A] tracking-tight">{campaign.budget ? `₹${campaign.budget.toLocaleString('en-IN')}` : '—'}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#0F172A]">Campaign Details</h4>
            {[
              { icon: Activity, label: 'Platform ID', value: campaign.platformCampaignId || 'Not linked' },
              { icon: Calendar, label: 'Duration', value: `${campaign.startDate ? format(new Date(campaign.startDate), 'MMM d, yyyy') : '—'} → ${campaign.endDate ? format(new Date(campaign.endDate), 'MMM d, yyyy') : 'Ongoing'}` },
              { icon: DollarSign, label: 'Est. Cost Per Lead', value: campaign.budget && leadCount > 0 ? `₹${(campaign.budget / leadCount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neutral-200/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
                  <row.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{row.label}</span>
                  <span className="block truncate text-sm font-bold text-[#0F172A]">{row.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
