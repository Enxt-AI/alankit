'use client';

/**
 * Dropped Checkouts Table component for Marketing Dashboard
 * Displays users who initiated checkout but dropped before completing payment
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
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
import { Search, Download, Copy, Check, ShoppingBag, PhoneCall, TrendingDown, Users, Wallet } from 'lucide-react';
import type { DroppedCheckoutItem } from '@/lib/marketing-api';
import { getStorageUrl } from '@/lib/utils';
import { toast } from 'sonner';

interface DroppedCheckoutsTableProps {
  items: DroppedCheckoutItem[];
  summary?: {
    totalDroppedCount: number;
    totalDroppedValue: number;
    uniqueUsersCount: number;
    avgDroppedValue: number;
  };
  isLoading?: boolean;
}

const paymentStatusStyles: Record<string, string> = {
  PENDING: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20',
  PROCESSING: 'bg-[#EFF6FF] text-[#2563EB] border-[#3B82F6]/20',
  FAILED: 'bg-[#FEF2F2] text-[#DC2626] border-[#EF4444]/20',
  CANCELLED: 'bg-neutral-50 text-[#64748B] border-neutral-200/60',
  EXPIRED: 'bg-[#FFF7ED] text-[#EA580C] border-[#FB923C]/20',
};

export default function DroppedCheckoutsTable({
  items = [],
  summary,
  isLoading = false,
}: DroppedCheckoutsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.userName.toLowerCase().includes(query) ||
        item.userEmail.toLowerCase().includes(query) ||
        item.userPhone.toLowerCase().includes(query) ||
        item.stockName.toLowerCase().includes(query) ||
        (item.orderNumber && item.orderNumber.toLowerCase().includes(query));

      // Status Filter
      const matchesStatus =
        statusFilter === 'ALL' || item.paymentStatus.toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const handleCopyContact = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Contact info copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const headers = [
      'Order Number',
      'User Name',
      'Email',
      'Phone',
      'Stock Name',
      'ISIN',
      'Quantity',
      'Price Per Share (INR)',
      'Total Amount (INR)',
      'Payment Status',
      'Checkout Date',
    ];

    const rows = filteredItems.map((item) => [
      item.orderNumber || item.id,
      `"${item.userName}"`,
      `"${item.userEmail}"`,
      `"${item.userPhone}"`,
      `"${item.stockName}"`,
      `"${item.stockIsin || ''}"`,
      item.quantity,
      item.pricePerShare,
      item.totalAmount,
      item.paymentStatus,
      `"${format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dropped_checkouts_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Summary KPI Strip — admin StatCard pattern */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Dropped', value: String(summary.totalDroppedCount), sub: 'Attempts', icon: ShoppingBag },
            { label: 'Revenue at risk', value: `₹${summary.totalDroppedValue.toLocaleString('en-IN')}`, sub: 'To recover', icon: TrendingDown },
            { label: 'Unique Users', value: String(summary.uniqueUsersCount), sub: 'Potential leads', icon: Users },
            { label: 'Avg Cart Value', value: `₹${Math.round(summary.avgDroppedValue).toLocaleString('en-IN')}`, sub: 'Per cart', icon: Wallet },
          ].map((kpi) => (
            <div key={kpi.label} className="flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><kpi.icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{kpi.label}</span>
                <span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{kpi.value}</span>
                <span className="mt-1 block text-[11px] font-semibold text-[#64748B]">{kpi.sub}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter and Search Action Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]/60" />
            <Input
              type="text"
              placeholder="Search user, stock, email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-10 rounded-xl border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Status Filter Dropdown */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border border-neutral-200/60 text-sm font-semibold text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
              <SelectValue placeholder="Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export CSV Button */}
        <Button
          onClick={handleExportCSV}
          variant="outline"
          className="w-full sm:w-auto h-10 px-4 rounded-xl border border-neutral-200/60 text-sm font-semibold text-[#0F172A] hover:bg-[#ECFDF5]/50 hover:text-[#16A34A] hover:border-[#16A34A]/30 flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Data Table */}
      <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
        <Table>
          <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
            <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 pl-6">User Details</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5">Stock / Asset</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-right">Quantity</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-right">Price / Share</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-right">Total Amount</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-center">Payment Status</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5">Checkout Date</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-neutral-400">
                  Loading dropped checkouts...
                </TableCell>
              </TableRow>
            ) : paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <ShoppingBag className="mx-auto h-8 w-8 text-neutral-300" />
                  <div className="mt-2 text-sm font-semibold text-[#0F172A]">No dropped checkouts</div>
                  <div className="mt-1 text-xs text-[#64748B]">No checkouts match your current search or status filter.</div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => {
                const statusStyle =
                  paymentStatusStyles[item.paymentStatus.toUpperCase()] || 'bg-neutral-50 text-[#64748B] border-neutral-200/60';

                return (
                  <TableRow key={item.id} className="border-b border-neutral-200/30 last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    {/* User Details */}
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-neutral-900">{item.userName}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                          <span>{item.userEmail || 'No Email'}</span>
                          {item.userPhone && (
                            <>
                              <span>•</span>
                              <span>{item.userPhone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Stock / Asset */}
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-neutral-100 p-1 flex items-center justify-center overflow-hidden">
                          {item.stockLogoUrl ? (
                            <img
                              src={getStorageUrl(item.stockLogoUrl)}
                              alt={item.stockName}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ShoppingBag className="h-4 w-4 text-neutral-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-neutral-900 truncate max-w-[180px]">
                            {item.stockName}
                          </span>
                          {item.stockIsin && (
                            <span className="text-[10px] text-neutral-400 font-mono tracking-tight">
                              {item.stockIsin}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="py-4 text-right font-medium text-sm text-neutral-700">
                      {item.quantity.toLocaleString('en-IN')}
                    </TableCell>

                    {/* Price per share */}
                    <TableCell className="py-4 text-right font-medium text-sm text-neutral-700">
                      ₹{item.pricePerShare.toLocaleString('en-IN')}
                    </TableCell>

                    {/* Total Amount */}
                    <TableCell className="py-4 text-right font-bold text-sm text-neutral-900">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell className="py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${statusStyle}`}>
                        {item.paymentStatus}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-4 text-xs text-neutral-500 font-medium">
                      {format(new Date(item.createdAt), 'MMM dd, yyyy • HH:mm')}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Copy Phone / Email Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleCopyContact(
                              `${item.userName} | Email: ${item.userEmail || 'N/A'} | Phone: ${item.userPhone || 'N/A'}`,
                              item.id
                            )
                          }
                          title="Copy Contact Info"
                          className="h-8 w-8 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-4 w-4 text-[#16A34A]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>

                        {/* WhatsApp / Direct Phone CTA */}
                        {item.userPhone && (
                          <a
                            href={`https://wa.me/${item.userPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#16A34A] bg-[#ECFDF5] hover:bg-[#DCFCE7] transition-colors"
                            title="Contact via WhatsApp"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-3 border-t border-neutral-200/40 bg-[#FAFBFC] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-neutral-500 font-medium">
            Showing <span className="font-semibold text-neutral-900">{paginatedItems.length}</span> of{' '}
            <span className="font-semibold text-neutral-900">{filteredItems.length}</span> dropped checkouts
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-neutral-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
