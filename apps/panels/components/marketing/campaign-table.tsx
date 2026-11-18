'use client';

import { format } from 'date-fns';
import { Edit2, Trash2, Facebook, Instagram, Search, Twitter, Database, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MarketingCampaign } from '@/lib/marketing-api';
import type { MarketingDashboardStats } from '@/lib/marketing-stats-api';

interface CampaignTableProps {
  campaigns: MarketingCampaign[];
  stats?: MarketingDashboardStats;
  onEdit: (campaign: MarketingCampaign) => void;
  onDelete: (campaign: MarketingCampaign) => void;
  onViewDetails: (campaign: MarketingCampaign) => void;
}

const statusConfig: Record<string, string> = {
  ACTIVE: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20',
  PAUSED: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20',
  COMPLETED: 'bg-neutral-50 text-[#64748B] border-neutral-200/60',
};

const platformIcons: Record<string, React.ReactNode> = {
  FACEBOOK: <Facebook className="h-3.5 w-3.5 text-blue-600" />,
  INSTAGRAM: <Instagram className="h-3.5 w-3.5 text-pink-600" />,
  GOOGLE: <Search className="h-3.5 w-3.5 text-red-500" />,
  TWITTER: <Twitter className="h-3.5 w-3.5 text-sky-500" />,
  SYSTEM: <Database className="h-3.5 w-3.5 text-[#64748B]" />,
};

export default function CampaignTable({ campaigns, stats, onEdit, onDelete, onViewDetails }: CampaignTableProps) {
  const getLeadCount = (campaignId: string) => {
    if (!stats) return 0;
    const campaignStat = stats.campaigns.find(c => c.id === campaignId) as any;
    return campaignStat?.leadCount || campaignStat?._count?.leads || 0;
  };

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <Megaphone className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-2 text-sm font-semibold text-[#0F172A]">No campaigns yet</p>
        <p className="mt-1 text-xs text-[#64748B]">Create your first campaign to start tracking leads.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
          <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
            <TableHead className="pl-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Campaign</TableHead>
            <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Platform</TableHead>
            <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Status</TableHead>
            <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Leads</TableHead>
            <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Budget</TableHead>
            <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">Timeline</TableHead>
            <TableHead className="pr-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-[#64748B]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id} className="group border-b border-neutral-200/30 last:border-0 hover:bg-[#F8FAFC] transition-colors">
              <TableCell className="pl-6 py-4">
                <button onClick={() => onViewDetails(campaign)} className="flex items-center gap-3 text-left">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#ECFDF5] text-[#16A34A] text-[11px] font-bold">
                      {campaign.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <span className="block max-w-[220px] truncate text-sm font-bold text-[#0F172A]">
                      {campaign.name}
                    </span>
                    <span className="block font-mono text-[10px] text-[#64748B]">#{campaign.id.substring(0, 8)}</span>
                  </span>
                </button>
              </TableCell>
              <TableCell className="py-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                  {platformIcons[campaign.platform as keyof typeof platformIcons]}
                  {campaign.platform}
                </span>
              </TableCell>
              <TableCell className="py-4">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${statusConfig[campaign.status] ?? statusConfig.COMPLETED}`}>
                  {campaign.status}
                </span>
              </TableCell>
              <TableCell className="py-4 text-sm font-bold text-[#0F172A]">
                {getLeadCount(campaign.id)}
              </TableCell>
              <TableCell className="py-4 text-sm font-semibold text-[#334155]">
                {campaign.budget ? `₹${campaign.budget.toLocaleString('en-IN')}` : '—'}
              </TableCell>
              <TableCell className="py-4 whitespace-nowrap text-xs font-semibold text-[#64748B]">
                {campaign.startDate ? format(new Date(campaign.startDate), 'MMM d, yyyy') : '—'}
                {' → '}
                {campaign.endDate ? format(new Date(campaign.endDate), 'MMM d, yyyy') : 'Ongoing'}
              </TableCell>
              <TableCell className="pr-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5]/50" onClick={(e) => { e.stopPropagation(); onEdit(campaign); }} aria-label="Edit campaign">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-[#64748B] hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(campaign); }} aria-label="Delete campaign">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
