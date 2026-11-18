'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, AlertCircle, TrendingUp, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { useAdminStocks } from '@/hooks/use-admin-stocks';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StockForm } from '@/components/admin/stock-form';
import { StockDeleteDialog } from '@/components/admin/stock-delete-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Stock } from '@/types/stock';
import { getStorageUrl, cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { startCompanySync, getCompanySyncStatus, type CompanySyncStatus } from '@/lib/stocks-api';

export default function CMSStocksPage() {
  const { cmsAdmin } = useCMSAuth();
  const router = useRouter();
  const hasStocksPermission = cmsAdmin?.permissions?.includes('cms_stocks') || cmsAdmin?.role === 'SUPER_ADMIN';

  // Early return if no permission
  if (!hasStocksPermission) {
    return (
      <div className="space-y-6 py-2">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">CMS: Stock Management</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Manage stock listings in the CMS
            </p>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to access stock management. Contact your administrator to enable{' '}
            <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">cms_stocks</code> permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Now call hook after return - safe
  // Use CMS endpoint for Content Managers with cms_panel_token
  const { data: stocks = [], isLoading, error, refetch } = useAdminStocks(true, true); // Force enabled: true since we checked, useCmsEndpoint: true

  // Permission check
  const canManage =
    cmsAdmin?.permissions?.includes('cms_stocks') ||
    cmsAdmin?.role === 'SUPER_ADMIN' ||
    false;

  const hasNoPermission = !hasStocksPermission;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editStock, setEditStock] = useState<Stock | null>(null);
  const [deleteStock, setDeleteStock] = useState<Stock | null>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter stocks by search query
  const filteredStocks = stocks.filter((stock) => {
    const query = debouncedQuery.toLowerCase();
    const cin = stock.cin || '';
    const isin = stock.isin || '';
    return (
      stock.name.toLowerCase().includes(query) ||
      cin.toLowerCase().includes(query) ||
      isin.toLowerCase().includes(query)
    );
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedStocks = filteredStocks.slice(startIndex, endIndex);

  // Batch sync state
  const [selectedCins, setSelectedCins] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<CompanySyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const status = await getCompanySyncStatus();
        setSyncStatus(status);
        setIsSyncing(status.active);
        if (!status.active && intervalId) {
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Failed to fetch sync status', err);
      }
    };

    fetchStatus();

    // Start/continue polling if active
    if (isSyncing || (syncStatus && syncStatus.active)) {
      intervalId = setInterval(fetchStatus, 1500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSyncing, syncStatus?.active]);

  const allFilteredCins = filteredStocks.filter((s) => s.cin).map((s) => s.cin as string);
  const isAllSelected =
    allFilteredCins.length > 0 && allFilteredCins.every((cin) => selectedCins.has(cin));

  const handleToggleRow = (cin: string) => {
    setSelectedCins((prev) => {
      const next = new Set(prev);
      if (next.has(cin)) {
        next.delete(cin);
      } else {
        next.add(cin);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCins((prev) => {
        const next = new Set(prev);
        allFilteredCins.forEach((cin) => next.delete(cin));
        return next;
      });
    } else {
      setSelectedCins((prev) => {
        const next = new Set(prev);
        allFilteredCins.forEach((cin) => next.add(cin));
        return next;
      });
    }
  };

  const handleStartSync = async () => {
    try {
      setIsSyncing(true);
      await startCompanySync(Array.from(selectedCins));
      setSelectedCins(new Set());
    } catch (err: any) {
      alert(err.message || 'Failed to start sync');
      setIsSyncing(false);
    }
  };

  // Clamp page to valid range when data changes
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">CMS: Stock Management</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage stock listings in the CMS
          </p>
        </div>
      </div>

      {syncStatus && (syncStatus.active || (syncStatus.total && syncStatus.processed !== undefined && syncStatus.processed < syncStatus.total) || (syncStatus.errors && syncStatus.errors.length > 0)) && (
        <div className="bg-white border border-neutral-200/40 rounded-[20px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                {syncStatus.active ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                )}
              </div>
              <div>
                <h2 className="font-bold text-sm text-[#0F172A]">
                  {syncStatus.active ? 'Syncing Probe42 Company Data' : 'Sync completed'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {syncStatus.active
                    ? `Processing ${syncStatus.currentName || 'companies'}...`
                    : `Successfully processed ${syncStatus.success} of ${syncStatus.total} companies.`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold bg-[#FAFBFC] border border-neutral-200/60 text-[#0F172A] px-2.5 py-1 rounded-lg">
                {syncStatus.processed} / {syncStatus.total}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#16A34A] h-full transition-all duration-500 ease-out"
              style={{ width: `${syncStatus.total && syncStatus.processed !== undefined ? (syncStatus.processed / syncStatus.total) * 100 : 0}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#64748B] font-semibold">
            <div>
              <span>Success: <span className="text-[#16A34A] font-bold">{syncStatus.success || 0}</span></span>
              <span className="mx-2">•</span>
              <span>Failed: <span className={(syncStatus.failed || 0) > 0 ? "text-rose-600 font-bold" : "text-[#64748B]"}>{syncStatus.failed || 0}</span></span>
            </div>
            {syncStatus.errors && syncStatus.errors.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowErrors(!showErrors)}
                className="h-7 px-2 hover:bg-rose-50 hover:text-rose-600 text-rose-500 text-xs font-bold"
              >
                {showErrors ? 'Hide Sync Errors' : `View Sync Errors (${syncStatus.errors.length})`}
              </Button>
            )}
          </div>

          {showErrors && syncStatus.errors && syncStatus.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-rose-50/50 border border-rose-100 p-3.5 space-y-2">
              {syncStatus.errors.map((err, i) => (
                <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-start justify-between border-b border-rose-100/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-bold text-rose-700">{err.name}</span>
                    <span className="text-[#64748B] font-mono text-[10px] ml-1.5">({err.cin})</span>
                  </div>
                  <span className="text-rose-600 font-mono mt-0.5 sm:mt-0 text-[11px]">{err.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search and Create Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            placeholder="Search stocks by name, CIN, or ISIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
          />
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {selectedCins.size > 0 && (
              <Button
                onClick={handleStartSync}
                disabled={isSyncing || !!syncStatus?.active}
                className="h-10 bg-white border border-[#16A34A] text-[#16A34A] hover:bg-[#ECFDF5] hover:text-[#0F172A] hover:border-[#16A34A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98] outline-none disabled:opacity-50"
              >
                Sync Probe42 Data ({selectedCins.size})
              </Button>
            )}
            <Button 
              onClick={() => setIsCreateOpen(true)}
              className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
            >
              <Plus className="h-4 w-4" />
              Add Stock
            </Button>
          </div>
        )}
      </div>

      {/* Page Size Selector */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
        <span>Show:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="px-2 py-1 text-xs font-semibold text-gray-900 border border-neutral-200 bg-white rounded-lg focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 h-8"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>per page</span>
      </div>

      {hasNoPermission && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to manage stocks. Contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      {!hasNoPermission && (
        <>
          {/* Loading State */}
          {isLoading && <AdminTableSkeleton rows={pageSize} columns={7} showActions={canManage} />}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="flex items-center justify-between text-red-800 w-full">
                <span>{error.message}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="rounded-xl border-red-200 text-red-800 hover:bg-red-100/50"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Stocks Table */}
          {!isLoading && !error && filteredStocks.length > 0 && (
            <>
              <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
                <Table>
                  <TableHeader className="bg-[#FAFBFC]">
                    <TableRow className="hover:bg-transparent border-b border-neutral-100">
                      {canManage && (
                        <TableHead className="w-[60px] text-center pl-6">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleToggleSelectAll}
                            className="data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A] scale-110"
                            aria-label="Select all stocks"
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-[80px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Logo</TableHead>
                      <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Name</TableHead>
                      <TableHead className="w-[220px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">CIN</TableHead>
                      <TableHead className="w-[150px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">PAN</TableHead>
                      <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Price</TableHead>
                      <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Status</TableHead>
                      <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Created</TableHead>
                      <TableHead className="w-[140px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStocks.map((stock) => (
                      <TableRow key={stock.id} className={cn("hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60", stock.cin && selectedCins.has(stock.cin) ? "bg-[#F1F5F9]/60 hover:bg-[#F1F5F9]" : "")}>
                        {canManage && (
                          <TableCell className="text-center pl-6 py-4">
                            <Checkbox
                              checked={!!stock.cin && selectedCins.has(stock.cin)}
                              onCheckedChange={() => stock.cin && handleToggleRow(stock.cin)}
                              disabled={!stock.cin}
                              className="data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A] scale-110"
                              aria-label={`Select ${stock.name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-4 pl-6">
                          {stock.logoUrl ? (
                            <img
                              src={getStorageUrl(stock.logoUrl)}
                              alt={`${stock.name} logo`}
                              className="h-8 w-8 rounded-xl object-cover border border-neutral-200/30"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-xl bg-neutral-50 border border-neutral-200/30 flex items-center justify-center text-[#64748B]">
                              <span className="text-xs font-bold">{stock.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-[#0F172A] py-4">{stock.name}</TableCell>
                        <TableCell className="font-mono text-sm text-[#0F172A] py-4">{stock.cin}</TableCell>
                        <TableCell className="font-mono text-sm py-4">
                          {stock.pan ? (
                            stock.pan
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 animate-pulse">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-[#0F172A] font-mono py-4">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(stock.price)}
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                            stock.isActive 
                              ? "bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20" 
                              : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                          )}>
                            {stock.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#64748B] py-4">
                          {new Date(stock.createdAt).toLocaleDateString()}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right py-4 pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditStock(stock)}
                                className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                                title="Edit Stock"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteStock(stock)}
                                className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Stock"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs font-semibold text-[#64748B]">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredStocks.length)} of{' '}
                    {filteredStocks.length} stocks
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
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
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredStocks.length === 0 && (
            <div 
              className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
              style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
            >
              <TrendingUp className="mb-3 h-8 w-8 text-[#64748B]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">
                {searchQuery ? 'No stocks found' : 'No stocks listings yet'}
              </h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Get started by adding your first stock listing.'}
              </p>
              {canManage && !searchQuery && (
                <Button 
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 h-9 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-xs px-3.5 py-1.5 transition-all duration-300 ease-in-out flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Your First Stock
                </Button>
              )}
            </div>
          )}

          {/* Create Stock Dialog */}
          <StockForm
            mode="create"
            isOpen={isCreateOpen}
            onCloseAction={() => setIsCreateOpen(false)}
            onSuccessAction={() => {
              setIsCreateOpen(false);
              refetch();
            }}
            useCmsEndpoint={true}
          />

          {/* Edit Stock Dialog */}
          {editStock && (
            <StockForm
              mode="edit"
              stock={editStock}
              isOpen={true}
              onCloseAction={() => setEditStock(null)}
              onSuccessAction={() => {
                setEditStock(null);
                refetch();
              }}
              useCmsEndpoint={true}
            />
          )}

          {/* Delete Stock Dialog */}
          {deleteStock && (
            <StockDeleteDialog
              stock={deleteStock}
              isOpen={!!deleteStock}
              onClose={() => setDeleteStock(null)}
              onSuccess={() => {
                setDeleteStock(null);
                refetch();
              }}
              useCmsEndpoint={true}
            />
          )}
        </>
      )}
    </div>
  );
}