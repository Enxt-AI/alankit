'use client';

import { CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Wallet, Facebook, Instagram, Search, Twitter, Database, CalendarDays } from 'lucide-react';
import type { MarketingCampaign } from '@/lib/marketing-api';

interface CampaignStatsCardProps {
  campaign: MarketingCampaign;
  stats: {
    leadCount: number;
    conversionRate: number;
    revenue?: number;
  };
  onClick?: () => void;
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

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</span>
        <span className="block truncate text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-0.5">{value}</span>
        {sub && <span className="block truncate text-[11px] font-semibold text-[#64748B] mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}

export default function CampaignStatsCard({ campaign, stats, onClick }: CampaignStatsCardProps) {
  const budget = campaign.budget ?? 0;
  const revenue = stats.revenue ?? 0;
  const cpl = stats.leadCount > 0 && budget > 0 ? budget / stats.leadCount : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${onClick ? 'cursor-pointer' : ''}`}
      style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="text-[15px] font-bold text-[#0F172A] truncate flex-1">
          {campaign.name}
        </CardTitle>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${statusConfig[campaign.status] ?? statusConfig.COMPLETED}`}>
          {campaign.status}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
        {platformIcons[campaign.platform] ?? platformIcons.SYSTEM}
        {campaign.platform}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat icon={<Users className="h-5 w-5" />} label="Leads" value={String(stats.leadCount)} />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="Conv." value={`${stats.conversionRate.toFixed(1)}%`} />
        <Stat icon={<DollarSign className="h-5 w-5" />} label="Revenue" value={`₹${revenue.toLocaleString('en-IN')}`} sub={cpl ? `₹${cpl.toFixed(0)}/lead` : undefined} />
        <Stat icon={<Wallet className="h-5 w-5" />} label="Budget" value={budget ? `₹${budget.toLocaleString('en-IN')}` : '—'} />
      </div>

      {(campaign.startDate || campaign.endDate) && (
        <div className="mt-4 pt-3 border-t border-neutral-200/40 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
            {' → '}
            {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing'}
          </span>
        </div>
      )}
    </div>
  );
}
