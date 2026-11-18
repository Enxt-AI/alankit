'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Search, RefreshCw, Eye, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { KycDetailDialog } from '@/components/admin/kyc-detail-dialog';
import { getUserDetailsWithKyc, type UserDetailsWithKyc } from '@/lib/support-users-api';
import { notify } from '@/components/ui/floating-notification';
import { DateRangePicker } from '@/components/ui/date-range-picker';

/**
 * Enhanced Admin User Management Page.
 * Replaces the old Demat Review page to show ALL signed up users.
 * Supports filtering by different statuses and reviewing users.
 */
export default function AdminUsersManagementPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Custom filter modes
  const [filterMode, setFilterMode] = useState<string>('ALL');
  
  // Date range filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Selection state for CSV export
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Rate limiting UI state
  const [isRefreshDisabled, setIsRefreshDisabled] = useState(false);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 500);
    return () => clearTimeout(timer);
  };

  // Resolve API filters based on the selected dropdown mode
  const apiFilters: any = {
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  if (filterMode === 'PENDING_DEMAT') {
    apiFilters.dematStatus = 'PENDING';
  } else if (filterMode === 'PENDING_KYC') {
    apiFilters.kycStatus = 'PENDING';
  } else if (filterMode === 'PENDING_BANK') {
    apiFilters.bankStatus = 'PENDING';
  } else if (filterMode === 'REJECTED_DEMAT') {
    apiFilters.dematStatus = 'REJECTED';
  } else if (filterMode === 'REJECTED_KYC') {
    apiFilters.kycStatus = 'REJECTED';
  } else if (filterMode === 'REJECTED_BANK') {
    apiFilters.bankStatus = 'REJECTED';
  } else if (filterMode === 'VERIFIED_ALL') {
    apiFilters.kycStatus = 'VERIFIED';
    apiFilters.dematStatus = 'VERIFIED';
  }

  // Fetch users
  const { data: users, isLoading, error, refetch } = useAdminUsers(apiFilters);

  // ===== SELECTION HELPERS =====

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!users) return;
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const isAllSelected = users && users.length > 0 && selectedIds.size === users.length;
  const isSomeSelected = selectedIds.size > 0 && (!users || selectedIds.size < users.length);

  // ===== CSV EXPORT =====


  /**
   * Flatten a UserDetailsWithKyc into a CSV-friendly flat object.
   * Field paths match the actual JSON structure used in kyc-detail-dialog.tsx.
   */
  const flattenUser = (u: UserDetailsWithKyc) => {
    const kycData = u.kycData || {};
    const panDetails = kycData.panDetails || {};
    const aadhaarDetails = kycData.aadhaarDetails || {};
    const bankData = u.bankData || {};
    const dematData = u.dematData || {};

    // Format address from aadhaar (can be object or string)
    const formatAddress = (address: any): string => {
      if (!address) return '';
      if (typeof address === 'string') return address;
      const parts = [address.house, address.street, address.loc, address.landmark, address.vtc, address.dist, address.state].filter(Boolean);
      return `${parts.join(', ')}${address.pc ? ` - ${address.pc}` : ''}`;
    };

    return {
      'Full Name': u.fullName || '',
      'Email': u.email || '',
      'Phone': u.phone || '',
      'Joined Date': u.createdAt ? format(new Date(u.createdAt), 'dd/MM/yyyy') : '',

      // KYC - PAN
      'KYC Status': u.kycStatus || '',
      'PAN Number': panDetails.pan || '',
      'PAN Name': panDetails.name || '',
      'PAN DOB': panDetails.dob || '',
      'PAN Verified': panDetails.verified ? 'Yes' : 'No',

      // KYC - Aadhaar
      'Aadhaar Number': aadhaarDetails.aadhaar || '',
      'Aadhaar Name': aadhaarDetails.name || '',
      'Aadhaar DOB': aadhaarDetails.dob || '',
      'Gender': aadhaarDetails.gender || '',
      'Father Name': aadhaarDetails.fatherName || '',
      'Address': formatAddress(aadhaarDetails.address),
      'Aadhaar Verified': aadhaarDetails.verified ? 'Yes' : 'No',

      // Bank
      'Bank Status': u.bankStatus || '',
      'Beneficiary Name': bankData.beneficiaryName || bankData.benificiaryName || bankData.accountHolder || '',
      'Bank Name': bankData.bankName || '',
      'Branch Name': bankData.branchName || '',
      'Account Number': bankData.accountNumber || bankData.accNo || '',
      'IFSC Code': bankData.ifsc || '',
      'Bank City': bankData.city || '',
      'Bank State': bankData.state || '',
      'MICR': bankData.micr || '',

      // Demat
      ...(() => {
        let rawAcc = (dematData.accountNumber || dematData.dematAccountNo || dematData.boId || '').toString().trim().toUpperCase();
        let rawDpId = (dematData.dpId || '').toString().trim().toUpperCase();
        let rawClientId = (dematData.clientId || '').toString().trim().toUpperCase();
        let fullBoId = rawAcc;
        if (!fullBoId && rawDpId && rawClientId) {
          fullBoId = `${rawDpId}${rawClientId}`;
        }
        if (fullBoId && fullBoId.length === 16) {
          rawDpId = fullBoId.slice(0, 8);
          rawClientId = fullBoId.slice(8);
        } else if (rawDpId.startsWith('IN') && (rawDpId.length + rawClientId.length === 16)) {
          const combined = `${rawDpId}${rawClientId}`;
          rawDpId = combined.slice(0, 8);
          rawClientId = combined.slice(8);
          fullBoId = combined;
        }
        return {
          'Demat Status': u.dematStatus || '',
          'BO ID': fullBoId || '',
          'DP ID': rawDpId || '',
          'Client ID': rawClientId || '',
        };
      })(),
    };
  };

  const handleExportCSV = async () => {
    if (selectedIds.size === 0) {
      notify.warning('Please select at least one user to export.');
      return;
    }

    setIsExporting(true);

    try {
      // Fetch detailed data for each selected user
      const detailPromises = Array.from(selectedIds).map((id) =>
        getUserDetailsWithKyc(id).catch(() => null)
      );
      const details = await Promise.all(detailPromises);
      const validDetails = details.filter(Boolean) as UserDetailsWithKyc[];

      if (validDetails.length === 0) {
        notify.error('Failed to fetch user details for export.');
        return;
      }

      // Flatten to CSV rows
      const rows = validDetails.map(flattenUser);

      // Build CSV string with proper escaping
      const headers = Object.keys(rows[0]!);
      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) =>
          headers.map((h) => escapeCSV(String((row as any)[h] ?? ''))).join(',')
        ),
      ];
      const csvString = csvLines.join('\n');

      // Trigger download
      const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.success(`Exported ${validDetails.length} user(s) successfully.`);
    } catch (err: any) {
      notify.error(err.message || 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render status badges uniformly
  const renderStatusBadge = (status: string | undefined | null) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-50 text-[#64748B] text-xs font-semibold border border-neutral-200/40">
          Not Initiated
        </span>
      );
    }
    
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#ECFDF5] text-[#16A34A] text-xs font-semibold border border-[#16A34A]/20">
            ✓ Verified
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FFFBEB] text-[#D97706] text-xs font-semibold border border-[#D97706]/20">
            Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FEF2F2] text-[#DC2626] text-xs font-semibold border border-[#DC2626]/20">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-50 text-[#64748B] text-xs font-semibold border border-neutral-200/40">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 py-2 relative">
      {/* Screen Freeze Overlay */}
      {isRefreshDisabled && (
        <div className="fixed inset-0 z-[100] bg-neutral-900/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white p-4 rounded-xl shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
            <span className="font-semibold text-sm text-[#0F172A]">Please wait before refreshing again...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            View all signed-up users and manage their KYC, Demat, and Bank verification statuses.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="rounded-xl border-neutral-200/60 text-[#0F172A] hover:bg-[#FAFBFC] font-semibold h-10 px-4"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-[#16A34A]" />
              ) : (
                <Download className="h-4 w-4 mr-2 text-[#16A34A]" />
              )}
              Export {selectedIds.size} User{selectedIds.size > 1 ? 's' : ''} CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isRefreshDisabled) return;
              setIsRefreshDisabled(true);
              refetch();
              setTimeout(() => {
                setIsRefreshDisabled(false);
              }, 8000);
            }}
            disabled={isLoading || isRefreshDisabled}
            className={`rounded-xl border-neutral-200/60 text-[#0F172A] font-semibold h-10 px-4 ${isRefreshDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#FAFBFC]'}`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshDisabled ? 'text-[#64748B]' : 'text-[#16A34A]'} ${isLoading ? 'animate-spin' : ''}`} />
            Refresh {isRefreshDisabled && <span className="ml-1 text-xs text-[#64748B]">(Wait)</span>}
          </Button>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="flex gap-4 flex-col sm:flex-row flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#64748B]/60" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-xl border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
          />
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={({ startDate, endDate }) => {
            setStartDate(startDate);
            setEndDate(endDate);
          }}
          triggerClassName="h-10 text-sm"
          placeholder="Filter by Registration Date"
        />
        <div className="flex items-center gap-2">
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[200px] bg-white h-10 rounded-xl border border-neutral-200/60 focus:ring-[#16A34A] focus:border-[#16A34A] text-sm text-[#0F172A] font-semibold">
              <SelectValue placeholder="Filter Users" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-neutral-200/40 bg-white">
              <SelectItem value="ALL">All Users</SelectItem>
              <SelectItem value="PENDING_DEMAT">Pending Demat</SelectItem>
              <SelectItem value="PENDING_KYC">Pending KYC</SelectItem>
              <SelectItem value="PENDING_BANK">Pending Bank</SelectItem>
              <SelectItem value="REJECTED_DEMAT">Rejected Demat</SelectItem>
              <SelectItem value="REJECTED_KYC">Rejected KYC</SelectItem>
              <SelectItem value="REJECTED_BANK">Rejected Bank</SelectItem>
              <SelectItem value="VERIFIED_ALL">Fully Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <AdminTableSkeleton rows={8} columns={7} />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 font-semibold">Error loading users: {error.message}</p>
          <Button onClick={() => refetch()} className="mt-4 rounded-xl bg-[#16A34A] hover:bg-[#15803d]">
            Try Again
          </Button>
        </div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-12 border border-neutral-200/40 rounded-[24px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <p className="text-[#64748B] font-semibold">
            {debouncedSearch
              ? `No users found matching your search and filter.`
              : `No users found for the selected filter.`}
          </p>
          {debouncedSearch && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="mt-4 rounded-xl border-neutral-200/60"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <Table>
            <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
              <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
                <TableHead className="w-[40px] py-3.5">
                  <Checkbox
                    checked={isAllSelected}
                    // indeterminate for some-selected
                    {...(isSomeSelected && !isAllSelected ? { 'data-state': 'indeterminate' } : {})}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all users"
                    className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
                  />
                </TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">User Information</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Joined</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">KYC Status</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Bank Status</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Demat Status</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={`border-b border-neutral-200/30 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-200 ${selectedIds.has(user.id) ? 'bg-[#ECFDF5]/40 hover:bg-[#ECFDF5]/50' : ''}`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="py-4">
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={() => toggleSelection(user.id)}
                      aria-label={`Select ${user.fullName || user.email}`}
                      className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
                    />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-[#0F172A] text-sm">{user.fullName || 'Unknown User'}</span>
                      <span className="text-xs font-medium text-[#64748B]">
                        {user.email || user.phone || 'No contact info'}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm font-semibold text-[#64748B] whitespace-nowrap py-4">
                    {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  
                  <TableCell className="py-4">
                    {renderStatusBadge(user.kycStatus)}
                  </TableCell>
                  
                  <TableCell className="py-4">
                    {renderStatusBadge(user.bankStatus)}
                  </TableCell>
                  
                  <TableCell className="py-4">
                    {renderStatusBadge(user.dematStatus)}
                  </TableCell>
 
                  <TableCell className="text-right py-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#16A34A] hover:text-[#15803d] hover:bg-[#ECFDF5]/50 rounded-lg font-semibold"
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View / Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
 
      {/* KYC Detail Dialog */}
      <KycDetailDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
      />
    </div>
  );
}
