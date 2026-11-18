'use client';

import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { useAuthStore } from '@/store/auth-store';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileCheck, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  AlertCircle, 
  Copy, 
  Check, 
  RotateCcw, 
  X 
} from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { format } from 'date-fns';
import { KycDetailDialog } from '@/components/admin/kyc-detail-dialog';
import { cn } from '@/lib/utils';

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  userDetails: 220,
  contactInfo: 240,
  panNumber: 160,
  submittedDate: 170,
  dematStatus: 150,
  actions: 110,
};

const STORAGE_KEY = 'operation_demat_approval_col_widths_v1';

const COLUMNS_CONFIG = [
  { key: 'userDetails', label: 'User Details', align: 'left' as const },
  { key: 'contactInfo', label: 'Contact Info', align: 'left' as const },
  { key: 'panNumber', label: 'PAN Card Number', align: 'left' as const },
  { key: 'submittedDate', label: 'Submitted Date', align: 'left' as const },
  { key: 'dematStatus', label: 'Demat Status', align: 'left' as const },
  { key: 'actions', label: 'Actions', align: 'right' as const },
];

/**
 * Operations Demat Approval Page
 * Allows Operations team to review, verify, and approve/reject user Demat linking requests.
 * Displays submitted Demat records (Client Master List / CML / CMR) with status filtering.
 * Protected by demat_approval (or legacy cms_demat_approval) permission.
 */
export default function OperationDematApprovalPage() {
  const { operationAdmin } = useAuthStore();
  const hasDematPermission =
    operationAdmin?.role === 'SUPER_ADMIN' ||
    operationAdmin?.permissions?.includes('demat_approval') ||
    operationAdmin?.permissions?.includes('cms_demat_approval');

  // Column resizing state (Excel-style)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
        }
      } catch (e) {}
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const saveWidths = (widths: Record<string, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {}
  };

  const resetAllColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify.success('Column widths reset to default');
  };

  const resetColumnWidth = (key: string) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, [key]: DEFAULT_COLUMN_WIDTHS[key] || 150 };
      saveWidths(updated);
      return updated;
    });
  };

  const resizingColRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const startResizing = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 150;
    resizingColRef.current = { key, startX, startWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const active = resizingColRef.current;
      if (!active) return;
      const delta = moveEvent.clientX - active.startX;
      const newWidth = Math.max(60, active.startWidth + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (resizingColRef.current) {
        setColumnWidths((latest) => {
          saveWidths(latest);
          return latest;
        });
      }
      resizingColRef.current = null;
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedPan, setCopiedPan] = useState<string | null>(null);

  const handleCopyPan = (e: React.MouseEvent, pan: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pan);
    setCopiedPan(pan);
    notify.success('PAN copied to clipboard');
    setTimeout(() => {
      setCopiedPan(null);
    }, 2000);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
    return () => clearTimeout(timer);
  };

  // Fetch Demat filtered users with search parameter (only if operator has permission)
  const { data: users = [], isLoading, error, refetch } = useAdminUsers(
    {
      dematStatus: statusFilter === 'ALL' ? undefined : statusFilter,
      dematSubmittedOnly: true,
      search: debouncedSearch || undefined,
    },
    { enabled: Boolean(hasDematPermission) }
  );

  const handleRefresh = async () => {
    if (!hasDematPermission) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Pagination calculations
  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return users.slice(startIndex, startIndex + pageSize);
  }, [users, currentPage, pageSize]);

  // Counts for quick filter metrics
  const counts = useMemo(() => {
    return {
      pending: users.filter((u) => u.dematStatus === 'PENDING').length,
      verified: users.filter((u) => u.dematStatus === 'VERIFIED').length,
      rejected: users.filter((u) => u.dematStatus === 'REJECTED').length,
    };
  }, [users]);

  // Early return if user lacks required permission
  if (!hasDematPermission) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                  Demat Approval
                </h1>
                <p className="text-sm font-medium text-[#64748B] mt-0.5">
                  Review pending Demat linking submissions and verify CML/CMR proofs.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to access Demat Approval. Contact your administrator to enable{' '}
            <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">
              demat_approval
            </code>{' '}
            permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
          Demat Approval
        </h1>
        <p className="text-xs font-medium text-[#64748B] mt-0.5">
          Review pending Demat linking submissions and verify CML/CMR proofs.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search by name, email, phone, or PAN..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-10 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#0F172A] placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-[#16A34A] focus-visible:border-[#16A34A] shadow-xs"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 pr-8 text-xs font-medium text-[#374151] hover:border-[#D1D5DB] focus:outline-none focus:ring-1 focus:ring-[#16A34A] focus:border-[#16A34A] cursor-pointer shadow-xs"
            >
              <option value="PENDING">Status: Pending Review</option>
              <option value="VERIFIED">Status: Verified</option>
              <option value="REJECTED">Status: Rejected</option>
              <option value="ALL">Status: All Submissions</option>
            </select>
          </div>

          {/* Active Filter Pill */}
          {statusFilter && statusFilter !== 'ALL' && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shadow-xs",
                statusFilter === 'PENDING'
                  ? "bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20"
                  : statusFilter === 'VERIFIED'
                  ? "bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20"
                  : "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20"
              )}
            >
              <span>
                {statusFilter === 'PENDING'
                  ? 'Pending Review'
                  : statusFilter === 'VERIFIED'
                  ? 'Verified'
                  : 'Rejected'}
              </span>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className="hover:opacity-75 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-10 px-4 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] font-medium text-xs rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {(isRefreshing || isLoading) && (
              <Loader2 className="h-3.5 w-3.5 text-[#16A34A] animate-spin" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Table Container */}
      {isLoading ? (
        <AdminTableSkeleton rows={6} columns={6} />
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-12 border border-red-100 rounded-2xl bg-red-50/40 text-center">
          <XCircle className="h-10 w-10 text-red-500 mb-3" />
          <h3 className="text-base font-bold text-[#0F172A]">Failed to load Demat submissions</h3>
          <p className="text-sm text-red-600 mt-1 max-w-sm">{(error as any)?.message || 'An unexpected error occurred.'}</p>
          <Button onClick={handleRefresh} className="mt-4 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl">
            Try Again
          </Button>
        </div>
      ) : totalUsers === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-neutral-200/40 rounded-2xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] text-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
            <UserCheck className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">No Demat Submissions Found</h3>
          <p className="text-sm font-medium text-[#64748B] mt-1 max-w-md">
            {debouncedSearch
              ? `No records found matching "${debouncedSearch}".`
              : statusFilter === 'PENDING'
              ? 'All pending Demat verification requests have been processed.'
              : `No records found with status "${statusFilter}".`}
          </p>
          {debouncedSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="mt-4 rounded-xl border-neutral-200/60 font-semibold"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
            {/* Card Subheader with Reset Widths & Total Count */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E5E7EB] bg-white">
              <button
                onClick={resetAllColumnWidths}
                className="text-[11px] font-medium text-[#6B7280] hover:text-[#111827] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset all column widths to default"
              >
                <RotateCcw size={12} />
                Reset column widths
              </button>

              <div className="text-xs text-[#4B5563]">
                <span>Total <span className="font-semibold text-[#111827]">{totalUsers}</span> submissions</span>
              </div>
            </div>

            {/* Table with resizable columns and no vertical grid lines */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  {COLUMNS_CONFIG.map((col) => (
                    <col
                      key={col.key}
                      style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 150}px` }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-[#F9FAFB]">
                    {COLUMNS_CONFIG.map((col) => (
                      <th
                        key={col.key}
                        style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 150}px` }}
                        className={cn(
                          "relative px-3.5 py-2.5 border-r border-b border-[#E5E7EB] last:border-r-0 text-[12px] font-semibold text-[#374151] select-none whitespace-nowrap overflow-hidden text-ellipsis",
                          col.align === 'right' && "text-right"
                        )}
                      >
                        <span title={col.label}>{col.label}</span>
                        {/* Column resizer handle */}
                        <div
                          onMouseDown={(e) => startResizing(col.key, e)}
                          onDoubleClick={() => resetColumnWidth(col.key)}
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-[#3B82F6] active:bg-[#2563EB] z-10 transition-colors"
                          title="Drag to resize, double-click to reset"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {paginatedUsers.map((user) => {
                    const initials = (user.fullName || user.email || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();

                    const panNumber =
                      user.panCardNumber ||
                      user.panNumber ||
                      (user.dematData as any)?.panNumber ||
                      (user.dematData as any)?.pan ||
                      (user.kycData as any)?.panDetails?.pan ||
                      (user.kycData as any)?.panNumber ||
                      (user.kycData as any)?.pan ||
                      null;

                    return (
                      <tr
                        key={user.id}
                        className="cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        {/* Name & Avatar */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[#ECFDF5] text-[#16A34A] font-bold text-xs flex items-center justify-center border border-[#16A34A]/20 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-[#0F172A] truncate">
                                {user.fullName || 'No Name Provided'}
                              </div>
                              <div className="text-[11px] font-normal text-[#64748B] sm:hidden truncate">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="px-3.5 py-3 truncate">
                          <div className="text-xs font-medium text-[#0F172A] truncate">
                            {user.email || '—'}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate">
                            {user.phone ? `+91 ${user.phone.replace(/^\+91/, '')}` : 'No phone linked'}
                          </div>
                        </td>

                        {/* PAN Card Number */}
                        <td className="px-3.5 py-3">
                          {panNumber ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-semibold text-[#0F172A] bg-neutral-100/90 px-2 py-0.5 rounded border border-neutral-200/80 tracking-wider inline-block">
                                {panNumber}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyPan(e, panNumber)}
                                className="inline-flex items-center justify-center h-5 w-5 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                                title="Copy PAN"
                                aria-label="Copy PAN"
                              >
                                {copiedPan === panNumber ? (
                                  <Check className="h-3 w-3 text-[#16A34A]" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-[#94A3B8] italic">
                              Not available
                            </span>
                          )}
                        </td>

                        {/* Submitted Date */}
                        <td className="px-3.5 py-3 text-xs text-[#64748B] truncate">
                          {user.updatedAt ? format(new Date(user.updatedAt), 'MMM dd, yyyy HH:mm') : '—'}
                        </td>

                        {/* Demat Status */}
                        <td className="px-3.5 py-3">
                          {user.dematStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Verified
                            </span>
                          ) : user.dematStatus === 'PENDING' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending Review
                            </span>
                          ) : user.dematStatus === 'REJECTED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-50 text-[#64748B] border border-neutral-200/40">
                              Not Linked
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserId(user.id);
                            }}
                            className="h-7 px-2.5 rounded-md border-[#16A34A]/30 text-[#16A34A] hover:bg-[#ECFDF5] hover:text-[#15803D] font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-xs font-semibold text-[#64748B]">
                Showing {Math.min(totalUsers, (currentPage - 1) * pageSize + 1)} to{' '}
                {Math.min(totalUsers, currentPage * pageSize)} of {totalUsers} submissions
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 rounded-lg border-neutral-200/60 font-semibold text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs font-bold text-[#0F172A] px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 rounded-lg border-neutral-200/60 font-semibold text-xs"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KYC & Demat Detail Modal */}
      <KycDetailDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
        dematOnly={true}
      />
    </div>
  );
}
