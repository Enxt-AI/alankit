'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCMSBaskets } from '@/hooks/use-cms-baskets';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { BasketForm } from '@/components/cms/basket-form';
import { BasketDeleteDialog } from '@/components/cms/basket-delete-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, AlertCircle, RefreshCw, FolderClosed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BasketWithConstituents } from '@/types/basket';

const BASKET_CATEGORIES = [
  'All',
  'High Growth',
  'Balanced',
  'Value',
  'Dividend',
  'Tech Focus',
  'ESG',
  'Blue Chip',
  'Small Cap',
  'International',
  'Sector Specific',
];

const BASKET_STATUSES = ['All', 'DRAFT', 'OPEN', 'CLOSED', 'COMING_SOON'];

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-[#64748B] border-neutral-200',
  OPEN: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20',
  CLOSED: 'bg-red-50 text-red-700 border-red-200/60',
  COMING_SOON: 'bg-[#EFF6FF] text-[#2563EB] border-[#3B82F6]/20',
};

export default function BasketsPage() {
  // Permission check
  const { cmsAdmin } = useCMSAuth();
  const hasPermission =
    cmsAdmin?.role === 'SUPER_ADMIN' || cmsAdmin?.permissions?.includes('cms_baskets');

  // Data fetching
  const {
    data: baskets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCMSBaskets(hasPermission);

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBasket, setEditBasket] = useState<BasketWithConstituents | null>(null);
  const [deleteBasket, setDeleteBasket] = useState<BasketWithConstituents | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtering logic
  const filteredBaskets = useMemo(() => {
    let filtered = baskets;

    // Search filter
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase();
      filtered = filtered.filter(
        (basket) =>
          basket.name.toLowerCase().includes(query) ||
          basket.category.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter((basket) => basket.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter((basket) => basket.status === statusFilter);
    }

    return filtered;
  }, [baskets, debouncedQuery, categoryFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredBaskets.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedBaskets = filteredBaskets.slice(startIndex, endIndex);

  // Clamp page when total pages change
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, page - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const handleSuccess = () => {
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const dropdownClass = "h-10 border-neutral-200 text-gray-900 bg-white focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus:ring-offset-0 focus-visible:ring-0 focus-visible:border-[#16A34A] rounded-[14px] transition-all duration-300 outline-none";

  // Permission guard AFTER all hooks (conditional early return before hooks breaks hook order
  // and surfaces as React error #185 / "rendered more hooks than during the previous render"
  // once auth resolves and hasPermission flips).
  if (!hasPermission) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">CMS: Basket Management</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">Manage curated stock baskets in the CMS</p>
          </div>
        </div>
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You don't have permission to access basket management. Contact an administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">CMS: Basket Management</h1>
        <p className="text-sm font-medium text-[#64748B] mt-1">Manage curated stock baskets in the CMS</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-4xl">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              placeholder="Search baskets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={cn(dropdownClass, "w-[180px]")}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-neutral-200 bg-white">
              {BASKET_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="hover:bg-[#F8FAFC]">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={cn(dropdownClass, "w-[150px]")}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-neutral-200 bg-white">
              {BASKET_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="hover:bg-[#F8FAFC]">
                  {status.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
        >
          <Plus className="h-4 w-4" />
          Add Basket
        </Button>
      </div>

      {/* Page Size Selector & Count info */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
        <span>Show</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            setPageSize(parseInt(value));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[80px] h-8 rounded-lg border-neutral-200 text-gray-900 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg border border-neutral-200 bg-white">
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span>per page</span>
      </div>

      {/* Table */}
      <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8">
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="flex items-center justify-between text-red-800 w-full">
                <span>{error?.message || 'Failed to load baskets'}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="rounded-xl border-red-200 text-red-800 hover:bg-red-100/50"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : paginatedBaskets.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center p-12 bg-white text-center"
          >
            <FolderClosed className="mb-3 h-8 w-8 text-[#64748B]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">No Curated Baskets Found</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
              {(searchQuery || categoryFilter !== 'All' || statusFilter !== 'All') 
                ? "Try adjusting your filters or search query."
                : "Create your first curated stock basket to get started."}
            </p>
            {(searchQuery || categoryFilter !== 'All' || statusFilter !== 'All') && (
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('All');
                  setStatusFilter('All');
                }}
                className="mt-4 text-[#16A34A] hover:text-[#16A34A]/80 font-bold text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#FAFBFC]">
              <TableRow className="hover:bg-transparent border-b border-neutral-100">
                <TableHead className="w-[80px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Icon</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Name</TableHead>
                <TableHead className="w-[140px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Category</TableHead>
                <TableHead className="w-[130px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Status</TableHead>
                <TableHead className="text-center w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Constituents</TableHead>
                <TableHead className="text-right w-[150px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Current Price</TableHead>
                <TableHead className="text-right w-[150px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Min Investment</TableHead>
                <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Created</TableHead>
                <TableHead className="text-right w-[100px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBaskets.map((basket) => (
                <TableRow key={basket.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                  <TableCell className="py-4 pl-6">
                    {basket.iconUrl ? (
                      <img
                        src={basket.iconUrl}
                        alt={basket.name}
                        className="h-10 w-10 rounded-xl object-cover border border-neutral-200/30"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png';
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-neutral-50 border border-neutral-200/30 flex items-center justify-center text-[#64748B] text-xs font-semibold">
                        N/A
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-sm text-[#0F172A] py-4">{basket.name}</TableCell>
                  <TableCell className="py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-neutral-50 text-[#64748B] border-neutral-200/60">
                      {basket.category}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    {!basket.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-red-100 text-red-800 border-red-300">
                        DELETED
                      </span>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                        STATUS_CLASSES[basket.status] || 'bg-neutral-100 text-[#64748B] border-neutral-200'
                      )}>
                        {basket.status.replace('_', ' ')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-sm text-[#0F172A] py-4">
                    {basket.constituents?.length || 0}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm text-[#0F172A] font-mono py-4">
                    {formatCurrency(basket.currentPrice || 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm text-[#0F172A] font-mono py-4">
                    {formatCurrency(basket.minInvestment)}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-[#64748B] py-4">
                    {formatDate(basket.createdAt)}
                  </TableCell>
                  <TableCell className="py-4 pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditBasket(basket)}
                        className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                        title="Edit basket"
                        disabled={!basket.isActive}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteBasket(basket)}
                        className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete basket"
                        disabled={!basket.isActive}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && paginatedBaskets.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-xs font-semibold text-[#64748B]">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredBaskets.length)} of{' '}
            {filteredBaskets.length} baskets
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageNum) => (
                <Button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    pageNum === page
                      ? "bg-[#16A34A] text-white border border-[#16A34A] rounded-xl font-bold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out cursor-default"
                      : "bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out active:scale-[0.98]"
                  )}
                >
                  {pageNum}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <BasketForm
        mode="create"
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleSuccess}
      />

      <BasketForm
        mode="edit"
        basket={editBasket || undefined}
        isOpen={!!editBasket}
        onClose={() => setEditBasket(null)}
        onSuccess={handleSuccess}
      />

      <BasketDeleteDialog
        basket={deleteBasket}
        isOpen={!!deleteBasket}
        onClose={() => setDeleteBasket(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
