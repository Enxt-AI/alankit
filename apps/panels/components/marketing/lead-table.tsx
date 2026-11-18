'use client';

/**
 * Reusable component to display list of marketing leads with pagination and actions
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useAssignLead, useBulkAssignLeads, useMarketingPanelUsers } from '@/hooks/use-marketing-stats';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ArrowUpDown, Users, CheckSquare, Download, X, ListFilter } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import type { LeadAnalytics } from '@/lib/marketing-api';

interface LeadTableProps {
  leads: LeadAnalytics[];
  onLeadClick?: (leadId: string) => void;
  /** Rows hidden upstream (e.g. Filter Leads panel) before reaching the table */
  hiddenUpstreamCount?: number;
  /** Distinct sources from the DB (merged with row values for the Source filter) */
  sources?: string[];
}

const kycStageConfig: Record<string, { label: string; className: string }> = {
  NOT_INITIATED: { label: 'Not Initiated', className: 'bg-neutral-50 text-[#64748B] border-neutral-200/60' },
  PENDING: { label: 'Pending', className: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20' },
  NOT_VERIFIED: { label: 'Not Verified', className: 'bg-[#FFF7ED] text-[#EA580C] border-[#FB923C]/20' },
  VERIFIED: { label: 'Verified', className: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20' },
};

const lastPaymentConfig: Record<string, { label: string; className: string }> = {
  NA: { label: 'NA', className: 'bg-neutral-50 text-[#64748B] border-neutral-200/60' },
  PENDING: { label: 'Pending', className: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20' },
  PAID: { label: 'Paid', className: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20' },
  NO_TRANSACTION: { label: 'No Transaction', className: 'bg-neutral-50 text-[#64748B] border-neutral-200/60' },
};

const esignStageConfig: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'Completed', className: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20' },
  NOT_COMPLETED: { label: 'Not completed', className: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20' },
};

const sourceConfig: Record<string, string> = {
  FACEBOOK: 'bg-[#EFF6FF] text-[#2563EB] border-[#3B82F6]/20',
  INSTAGRAM: 'bg-[#FDF2F8] text-[#DB2777] border-[#EC4899]/20',
  GOOGLE: 'bg-[#FEF2F2] text-[#DC2626] border-[#EF4444]/20',
  TWITTER: 'bg-[#F0F9FF] text-[#0284C7] border-[#38BDF8]/20',
  IMPORTED: 'bg-[#F5F3FF] text-[#7C3AED] border-[#8B5CF6]/20',
};

interface ColumnFilters {
  clientId: string;
  name: string;
  phone: string;
  kyc: string;
  payment: string;
  esign: string;
  source: string;
}

const emptyColumnFilters: ColumnFilters = {
  clientId: '',
  name: '',
  phone: '',
  kyc: 'ALL',
  payment: 'ALL',
  esign: 'ALL',
  source: 'ALL',
};

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function leadToCsvRow(lead: LeadAnalytics): string[] {
  return [
    lead.clientId,
    lead.name,
    lead.phoneMasked || '',
    lead.source || '',
    lead.kycStage,
    lead.lastPaymentStatus,
    lead.esignStage === 'COMPLETED' ? 'Completed' : lead.esignStage === 'NOT_COMPLETED' ? 'Not completed' : '—',
    lead.kycStage === 'NOT_INITIATED' ? 'NA' : String(lead.totalTransactionCount),
    String(lead.transactionCount),
    lead.kycStage === 'NOT_INITIATED' ? 'NA' : String(lead.totalTransactionValue),
    String(lead.transactionValue),
    String(lead.sharesRequested),
    lead.kycStage === 'NOT_INITIATED' ? 'NA' : (lead.lastShareName || ''),
    (lead.requestedShareNames || []).join(', '),
    formatLastActivity((lead as any).lastActivityAt),
  ];
}

export const LEAD_CSV_HEADERS = [
  'Client ID',
  'Name',
  'Phone Number',
  'Source',
  'KYC Status',
  'Last Payment Status',
  'Dropped at esign',
  'Total Transaction Count',
  'Successful Transaction Count',
  'Total Transaction Value',
  'Successful Transaction Value',
  'Successful Shares',
  'Last Share',
  'Shares Requested',
  'Last Activity',
];

function formatLastActivity(value: unknown): string {
  if (!value) return '—';
  try {
    return format(new Date(value as string), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
}

export default function LeadTable({
  leads,
  onLeadClick,
  hiddenUpstreamCount = 0,
  sources = []
}: LeadTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(emptyColumnFilters);
  
  type SortField = 'transactionValue' | 'transactionCount' | 'totalTransactionCount' | 'totalTransactionValue' | 'kycStatus' | 'paymentStatus' | 'esignStage' | 'source' | 'lastActivityAt' | null;
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { marketingAdmin } = useMarketingAuth();
  const { mutate: assignLead } = useAssignLead();
  const { mutate: bulkAssignLeads, isPending: isBulkAssigning } = useBulkAssignLeads();
  const { data: panelUsers } = useMarketingPanelUsers();

  const canAssignLeads = marketingAdmin?.role === 'SUPER_ADMIN' || marketingAdmin?.role === 'MARKETING_MANAGER' || marketingAdmin?.permissions?.includes('marketing_lead_assign');

  // Distinct sources for the Source column filter: DB-wide list merged with
  // values present in the loaded rows (covers paginated-out rows too).
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => { if (s) set.add(s); });
    leads.forEach((lead) => { if (lead.source) set.add(lead.source); });
    return Array.from(set).sort();
  }, [leads, sources]);

  const hasActiveColumnFilters =
    columnFilters.clientId.trim() !== '' ||
    columnFilters.name.trim() !== '' ||
    columnFilters.phone.trim() !== '' ||
    columnFilters.kyc !== 'ALL' ||
    columnFilters.payment !== 'ALL' ||
    columnFilters.esign !== 'ALL' ||
    columnFilters.source !== 'ALL';

  const handleColumnFilterChange = (key: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleClearColumnFilters = () => {
    setColumnFilters(emptyColumnFilters);
    setCurrentPage(1);
  };

  const handleExportLead = (lead: LeadAnalytics) => {
    try {
      const csvContent = [LEAD_CSV_HEADERS, leadToCsvRow(lead)]
        .map((row) => row.map(csvEscape).join(','))
        .join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lead_${lead.clientId || lead.id}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export lead:', err);
    }
  };

  // Filter leads based on search query + per-column filters
  const filteredLeads = useMemo(() => {
    let filtered = leads;
    if (hasActiveColumnFilters) {
      const cfClient = columnFilters.clientId.toLowerCase().trim();
      const cfName = columnFilters.name.toLowerCase().trim();
      const cfPhone = columnFilters.phone.toLowerCase().trim();
      filtered = filtered.filter((lead) => {
        if (cfClient && !(lead.clientId || '').toLowerCase().includes(cfClient)) return false;
        if (cfName && !(lead.name || '').toLowerCase().includes(cfName)) return false;
        if (cfPhone && !(lead.phoneMasked || '').toLowerCase().includes(cfPhone)) return false;
        if (columnFilters.kyc !== 'ALL' && lead.kycStage !== columnFilters.kyc) return false;
        if (columnFilters.payment !== 'ALL' && lead.lastPaymentStatus !== columnFilters.payment) return false;
        if (columnFilters.esign !== 'ALL' && (lead.esignStage || 'NONE') !== columnFilters.esign) return false;
        if (columnFilters.source !== 'ALL' && (lead.source || '') !== columnFilters.source) return false;
        return true;
      });
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const queryDigits = searchQuery.replace(/\D/g, '');
      filtered = filtered.filter((lead) => {
        if (
          lead.name?.toLowerCase().includes(query) ||
          lead.clientId?.toLowerCase().includes(query) ||
          lead.phoneMasked?.toLowerCase().includes(query)
        ) {
          return true;
        }
        // Phone is masked (******1712), so a fully typed number can only match
        // on its trailing digits. Full phone search is handled server-side.
        if (queryDigits.length > 0) {
          const maskedDigits = (lead.phoneMasked || '').replace(/\D/g, '');
          if (maskedDigits && maskedDigits.endsWith(queryDigits.slice(-4))) {
            return true;
          }
        }
        return false;
      });
    }
    
    // Sort leads (null-safe so nullable columns like source/esignStage sort last)
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue: any = a[sortField] ?? '';
        const bValue: any = b[sortField] ?? '';

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [leads, searchQuery, sortField, sortDirection, columnFilters, hasActiveColumnFilters]);

  // Paginate filtered leads
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLeads.slice(startIndex, endIndex);
  }, [filteredLeads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleAssignUser = (leadId: string, userId: string) => {
    if (userId === 'none') return;
    assignLead({ leadId, userId });
  };

  const handleBulkAssignUser = (userId: string) => {
    if (userId === 'none' || selectedLeads.size === 0) return;
    bulkAssignLeads({ leadIds: Array.from(selectedLeads), userId }, {
      onSuccess: () => {
        setSelectedLeads(new Set());
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map(l => l.id)));
    }
  };

  const toggleSelectLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  return (
    <div className="space-y-4">
      {/* Search and pagination controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]/60" />
          <Input
            placeholder="Search name, client ID, phone…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-xl border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowColumnFilters((v) => !v)}
            className={`h-10 px-3.5 rounded-xl border text-sm font-semibold flex items-center gap-1.5 ${showColumnFilters || hasActiveColumnFilters ? 'border-[#16A34A]/30 bg-[#ECFDF5] text-[#16A34A]' : 'border-neutral-200/60 text-[#0F172A] hover:bg-[#ECFDF5]/50'}`}
          >
            <ListFilter className="h-4 w-4" />
            Columns
            {hasActiveColumnFilters && (
              <span className="ml-0.5 rounded-md bg-[#16A34A] text-white text-[10px] font-bold px-1.5 py-0.5">
                {[columnFilters.clientId, columnFilters.name, columnFilters.phone].filter((v) => v.trim() !== '').length +
                  [columnFilters.kyc, columnFilters.payment, columnFilters.esign, columnFilters.source].filter((v) => v !== 'ALL').length}
              </span>
            )}
          </Button>
          {hasActiveColumnFilters && (
            <Button
              variant="ghost"
              onClick={handleClearColumnFilters}
              className="h-10 px-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#ECFDF5] rounded-xl"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
          <span className="text-xs font-semibold text-[#64748B]">Show:</span>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-[90px] h-10 rounded-xl border border-neutral-200/60 text-sm font-semibold text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.size > 0 && canAssignLeads && (
        <div className="flex items-center justify-between p-3 bg-[#EFF6FF] border border-[#3B82F6]/20 rounded-[14px]">
          <div className="text-sm font-bold text-[#2563EB]">
            {selectedLeads.size} lead(s) selected
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B]">Bulk Assign To:</span>
            <Select onValueChange={handleBulkAssignUser} disabled={isBulkAssigning}>
              <SelectTrigger className="w-[180px] h-9 rounded-[10px] border border-neutral-200/60 bg-white text-xs font-semibold text-[#0F172A]">
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select user...</SelectItem>
                {panelUsers?.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-x-auto" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
        <Table>
          <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
            <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
              <TableHead className="w-12 pl-6 py-3.5">
                <Checkbox checked={paginatedLeads.length > 0 && selectedLeads.size === paginatedLeads.length} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              </TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Client ID</TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Name</TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Phone Number</TableHead>
              <TableHead
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center gap-1">
                  Source
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors"
                onClick={() => handleSort('kycStatus')}
              >
                <div className="flex items-center gap-1">
                  KYC Status
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors"
                onClick={() => handleSort('paymentStatus')}
              >
                <div className="flex items-center gap-1">
                  Last Payment Status
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors"
                onClick={() => handleSort('esignStage')}
              >
                <div className="flex items-center gap-1">
                  Dropped at esign
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors text-right"
                onClick={() => handleSort('totalTransactionCount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Total Txn Count
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors text-right"
                onClick={() => handleSort('transactionCount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Successful Txn Count
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors text-right"
                onClick={() => handleSort('totalTransactionValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  Total Txn Value
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors text-right"
                onClick={() => handleSort('transactionValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  Successful Txn Value
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right pr-6">Successful Shares</TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Last Share</TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pr-6">Shares Requested</TableHead>
              <TableHead
                className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 cursor-pointer hover:bg-neutral-100/50 transition-colors"
                onClick={() => handleSort('lastActivityAt')}
              >
                <div className="flex items-center gap-1">
                  Last Activity
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right pr-6">Actions</TableHead>
            </TableRow>
            {showColumnFilters && (
              <TableRow className="border-b border-neutral-200/40 bg-[#FAFBFC]/60 hover:bg-[#FAFBFC]/60">
                <TableCell />
                <TableCell className="py-2">
                  <Input
                    placeholder="Filter ID…"
                    value={columnFilters.clientId}
                    onChange={(e) => handleColumnFilterChange('clientId', e.target.value)}
                    className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs px-2 focus-visible:ring-1 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A]"
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    placeholder="Filter name…"
                    value={columnFilters.name}
                    onChange={(e) => handleColumnFilterChange('name', e.target.value)}
                    className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs px-2 focus-visible:ring-1 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A]"
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    placeholder="Filter phone…"
                    value={columnFilters.phone}
                    onChange={(e) => handleColumnFilterChange('phone', e.target.value)}
                    className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs px-2 focus-visible:ring-1 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A]"
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Select value={columnFilters.source} onValueChange={(v) => handleColumnFilterChange('source', v)}>
                    <SelectTrigger className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs font-semibold">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All sources</SelectItem>
                      {availableSources.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2">
                  <Select value={columnFilters.kyc} onValueChange={(v) => handleColumnFilterChange('kyc', v)}>
                    <SelectTrigger className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs font-semibold">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {Object.keys(kycStageConfig).map((k) => (
                        <SelectItem key={k} value={k}>{kycStageConfig[k]!.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2">
                  <Select value={columnFilters.payment} onValueChange={(v) => handleColumnFilterChange('payment', v)}>
                    <SelectTrigger className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs font-semibold">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {Object.keys(lastPaymentConfig).map((k) => (
                        <SelectItem key={k} value={k}>{lastPaymentConfig[k]!.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2">
                  <Select value={columnFilters.esign} onValueChange={(v) => handleColumnFilterChange('esign', v)}>
                    <SelectTrigger className="h-8 rounded-lg border border-neutral-200/60 bg-white text-xs font-semibold">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="NOT_COMPLETED">Not completed</SelectItem>
                      <SelectItem value="NONE">— (never initiated)</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell colSpan={9} />
                <TableCell />
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {paginatedLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-10">
                  <Users className="mx-auto h-8 w-8 text-neutral-300" />
                  <div className="mt-2 text-sm font-semibold text-[#0F172A]">{searchQuery ? 'No matches found' : hiddenUpstreamCount > 0 ? 'All leads hidden by filters' : 'No leads yet'}</div>
                  <div className="mt-1 text-xs text-[#64748B]">
                    {searchQuery
                      ? 'Try a different search or clear the column filters.'
                      : hiddenUpstreamCount > 0
                        ? `${hiddenUpstreamCount} lead${hiddenUpstreamCount === 1 ? '' : 's'} hidden by the Filter Leads panel (e.g. Last Payment Status) — Clear all to view.`
                        : 'Import a CSV or add your first lead to get started.'}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedLeads.map((lead) => {
                const kyc = kycStageConfig[lead.kycStage] ?? kycStageConfig.PENDING!;
                const lastPay = lastPaymentConfig[lead.lastPaymentStatus] ?? lastPaymentConfig.PENDING!;
                const esign = lead.esignStage ? esignStageConfig[lead.esignStage] : null;
                const notInitiated = lead.kycStage === 'NOT_INITIATED';
                return (
                <TableRow
                  key={lead.id}
                  className={`border-b border-neutral-200/30 cursor-pointer transition-colors ${selectedLeads.has(lead.id) ? 'bg-[#ECFDF5]/40' : 'hover:bg-[#F8FAFC]'}`}
                  onClick={() => onLeadClick?.(lead.id)}
                >
                  <TableCell className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedLeads.has(lead.id)} onCheckedChange={() => toggleSelectLead(lead.id)} aria-label="Select lead" />
                  </TableCell>
                  <TableCell className="py-4 font-mono text-[10px] text-[#64748B]">{lead.clientId}</TableCell>
                  <TableCell className="py-4">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onLeadClick?.(lead.id); }} className="flex items-center gap-2.5 text-left" title="View lead details">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[#ECFDF5] text-[#16A34A] text-[11px] font-bold">{(lead.name || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-[160px] truncate text-sm font-bold text-[#0F172A] hover:text-[#16A34A] hover:underline hover:underline-offset-2">{lead.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#334155] py-4 whitespace-nowrap">
                    {lead.phoneMasked || '—'}
                  </TableCell>
                  <TableCell className="py-4">
                    {lead.source ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${sourceConfig[lead.source] ?? 'bg-neutral-50 text-[#64748B] border-neutral-200/60'}`}>{lead.source}</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#64748B]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${kyc.className}`}>{kyc.label}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${lastPay.className}`}>{lastPay.label}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    {esign ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${esign.className}`}>{esign.label}</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#64748B]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-bold text-[#0F172A] py-4 text-right">
                    {notInitiated ? 'NA' : lead.totalTransactionCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm font-bold text-[#0F172A] py-4 text-right">
                    {lead.transactionCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm font-bold text-[#0F172A] py-4 text-right whitespace-nowrap">
                    {notInitiated ? 'NA' : `₹${lead.totalTransactionValue.toLocaleString('en-IN')}`}
                  </TableCell>
                  <TableCell className="text-sm font-bold text-[#0F172A] py-4 text-right whitespace-nowrap">
                    ₹{lead.transactionValue.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-sm font-bold text-[#0F172A] py-4 pr-6 text-right">
                    {lead.sharesRequested.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#334155] py-4 max-w-[160px] truncate" title={lead.lastShareName || ''}>
                    {notInitiated ? 'NA' : (lead.lastShareName || '—')}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#334155] py-4 pr-6 max-w-[180px] truncate" title={(lead.requestedShareNames || []).join(', ')}>
                    {(lead.requestedShareNames || []).length > 0 ? lead.requestedShareNames.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#334155] py-4 whitespace-nowrap" title={formatLastActivity((lead as any).lastActivityAt)}>
                    {formatLastActivity((lead as any).lastActivityAt)}
                  </TableCell>
                  <TableCell className="py-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExportLead(lead)}
                      title={`Export ${lead.name || 'lead'} to CSV`}
                      aria-label={`Export ${lead.name || 'lead'} to CSV`}
                      className="h-8 w-8 rounded-lg text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5]"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-semibold text-[#64748B]">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of{' '}
            {filteredLeads.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-neutral-200/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ECFDF5] hover:text-[#0F172A] hover:border-[#16A34A] transition-all duration-300 active:scale-[0.98]"
            >
              Previous
            </Button>
            <span className="text-xs text-[#64748B] font-semibold">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-neutral-200/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ECFDF5] hover:text-[#0F172A] hover:border-[#16A34A] transition-all duration-300 active:scale-[0.98]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
