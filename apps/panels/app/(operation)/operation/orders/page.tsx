'use client';

/**
 * Operation Orders Management Page
 * 
 * Replica of Admin Orders Management Page
 * Allows operation staff to view all orders, filter by status, search by user/stock,
 * and update order status.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuthStore } from '@/store/auth-store';
import { useAdminOrders, useUpdateOrderStatus } from '@/hooks/use-admin-orders';
import { useQueryClient } from '@tanstack/react-query';
import { updateOrderStatus } from '@/lib/orders-api';
import { markBatchGenerate } from '@/lib/batch-api';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Upload, X, Loader2, CheckCircle2, XCircle, AlertTriangle, Pencil, AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, Search, Copy, Check } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { StatusUpdater } from '@/components/admin/status-updater';
import { OrderStatus, OrderWithDetails } from '@/types/order';
import { ApproveOrderDialog } from '@/components/operation/orders/ApproveOrderDialog';
import DateRangePicker from '@/components/operation/orders/date-picker';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  select: 44,
  orderNumber: 130,
  clientName: 160,
  stockName: 180,
  isin: 130,
  quantity: 90,
  pricePerShare: 115,
  totalAmount: 125,
  status: 210,
  dematStatus: 120,
  paymentStatus: 110,
  createdAt: 160,
  cashfreePaymentId: 145,
  panNo: 115,
  boId: 145,
  dpId: 105,
  clientId: 105,
  transferReferenceNo: 175,
  transferDate: 120,
};

const STORAGE_KEY = 'operation_orders_col_widths_v3';

const COLUMNS_CONFIG = [
  { key: 'select', label: '', align: 'center' as const },
  { key: 'orderNumber', label: 'Order ID', align: 'left' as const },
  { key: 'clientName', label: 'Client Name', align: 'left' as const },
  { key: 'stockName', label: 'Stock Name', align: 'left' as const },
  { key: 'isin', label: 'ISIN', align: 'left' as const },
  { key: 'quantity', label: 'Quantity', align: 'right' as const },
  { key: 'pricePerShare', label: 'Price / Share', align: 'right' as const },
  { key: 'totalAmount', label: 'Order Amt.', align: 'right' as const },
  { key: 'status', label: 'Status', align: 'left' as const },
  { key: 'dematStatus', label: 'Demat Status', align: 'left' as const },
  { key: 'paymentStatus', label: 'Payment', align: 'left' as const },
  { key: 'createdAt', label: 'Date & Time', align: 'left' as const },
  { key: 'cashfreePaymentId', label: 'Transaction ID', align: 'left' as const },
  { key: 'panNo', label: 'PAN No.', align: 'left' as const },
  { key: 'boId', label: 'BO ID', align: 'left' as const },
  { key: 'dpId', label: 'DP ID', align: 'left' as const },
  { key: 'clientId', label: 'Client ID', align: 'left' as const },
  { key: 'transferReferenceNo', label: 'Transfer Ref. No.', align: 'left' as const },
  { key: 'transferDate', label: 'Transfer Date', align: 'left' as const },
];

const formatCashfreeDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

export default function OperationOrdersPage() {
  const { operationAdmin } = useAuthStore();
  const updateMutation = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const getDematInfo = (user: any) => {
    if (!user) return { dpId: '—', clientId: '—', boId: '—' };
    
    let parsed: any = null;
    if (user.dematData) {
      try {
        parsed = typeof user.dematData === 'string'
          ? JSON.parse(user.dematData)
          : user.dematData;
      } catch (e) {}
    }

    // Fallback to kycData dematDetails if dematData is empty
    if (!parsed && user.kycData) {
      try {
        const kycParsed = typeof user.kycData === 'string'
          ? JSON.parse(user.kycData)
          : user.kycData;
        parsed = kycParsed?.dematDetails || kycParsed?.demat;
      } catch (e) {}
    }

    if (!parsed || typeof parsed !== 'object') {
      return { dpId: '—', clientId: '—', boId: '—' };
    }

    let rawAcc = (parsed.accountNumber || parsed.dematAccountNo || parsed.boId || '').toString().trim().toUpperCase();
    let rawDpId = (parsed.dpId || '').toString().trim().toUpperCase();
    let rawClientId = (parsed.clientId || '').toString().trim().toUpperCase();

    let fullBoId = rawAcc;
    // If no explicit BO ID but both DP ID and Client ID exist
    if (!fullBoId && rawDpId && rawClientId) {
      fullBoId = `${rawDpId}${rawClientId}`;
    }

    // Standard format for both NSDL and CDSL is 16 characters total:
    // - NSDL: DP ID = 8 chars (IN + 6 digits), Client ID = 8 digits
    // - CDSL: DP ID = 8 digits, Client ID = 8 digits
    // Always re-slice when 16 characters exist to self-heal historical bad splits
    if (fullBoId && fullBoId.length === 16) {
      rawDpId = fullBoId.slice(0, 8);
      rawClientId = fullBoId.slice(8);
    } else if (rawDpId.startsWith('IN') && (rawDpId.length + rawClientId.length === 16)) {
      const combined = `${rawDpId}${rawClientId}`;
      rawDpId = combined.slice(0, 8);
      rawClientId = combined.slice(8);
      fullBoId = combined;
    }

    const dpId = rawDpId || '—';
    const clientId = rawClientId || '—';
    const boId = fullBoId || (dpId !== '—' && clientId !== '—' ? `${dpId}${clientId}` : '—');

    return { dpId, clientId, boId };
  };

  const getBankInfo = (user: any) => {
    let bankName = '—';
    let accNo = '—';
    let ifsc = '—';

    if (user?.bankData) {
      try {
        const parsed = typeof user.bankData === 'string'
          ? JSON.parse(user.bankData)
          : user.bankData;
        if (parsed && typeof parsed === 'object') {
          accNo = parsed.accNo || parsed.accountNumber || '—';
          ifsc = (parsed.ifsc || '—').toUpperCase();
          bankName = parsed.bankName || parsed.bankNameManual || parsed.benificiaryName || '—';
        }
      } catch (e) {}
    } 
    
    if ((bankName === '—' || accNo === '—') && user?.kycData) {
      try {
        const parsed = typeof user.kycData === 'string'
          ? JSON.parse(user.kycData)
          : user.kycData;
        if (parsed?.bankDetails) {
          bankName = parsed.bankDetails.bankName || bankName;
          accNo = parsed.bankDetails.accountNumber || accNo;
          ifsc = (parsed.bankDetails.ifsc || ifsc).toUpperCase();
        }
      } catch (e) {}
    }
    
    return { accNo, ifsc, bankName };
  };

  const getPanInfo = (user: any) => {
    if (!user) return '—';
    if (user.panNumber) return String(user.panNumber).toUpperCase();
    
    if (user.kycData) {
      try {
        const parsed = typeof user.kycData === 'string'
          ? JSON.parse(user.kycData)
          : user.kycData;
        const pan = parsed?.panDetails?.pan || parsed?.pan || parsed?.panNumber;
        if (pan && typeof pan === 'string' && !pan.startsWith('v1.')) {
          return pan.toUpperCase();
        }
      } catch (e) {}
    }

    if (user.dematData) {
      try {
        const parsed = typeof user.dematData === 'string'
          ? JSON.parse(user.dematData)
          : user.dematData;
        const pan = parsed?.panNumber || parsed?.pan || parsed?.panDetails?.pan;
        if (pan && typeof pan === 'string' && !pan.startsWith('v1.')) {
          return pan.toUpperCase();
        }
      } catch (e) {}
    }

    return '—';
  };

  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const canUpdate = operationAdmin?.permissions?.includes('update_orders') || isSuperAdmin;
  const hasEditTransferPermission = operationAdmin?.permissions?.includes('edit_order_transfer') || isSuperAdmin;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dematStatusFilter, setDematStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const handleCopyOrderId = (orderIdText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(orderIdText);
    setCopiedOrderId(orderIdText);
    notify.success(`Copied ${orderIdText}`);
    setTimeout(() => {
      setCopiedOrderId((prev) => (prev === orderIdText ? null : prev));
    }, 2000);
  };

  const handleDatePresetSelect = (preset: string) => {
    setDatePreset(preset);
    setPage(1);

    const now = new Date();
    const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
    const formatDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const todayStr = formatDateStr(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = formatDateStr(yesterday);
      setFromDate(yesterdayStr);
      setToDate(yesterdayStr);
    } else if (preset === '7days') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setFromDate(formatDateStr(weekAgo));
      setToDate(formatDateStr(now));
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDateStr(firstDay));
      setToDate(formatDateStr(now));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'custom') {
      setIsFilterOpen(true);
    }
  };

  const getDatePresetLabel = () => {
    if (datePreset === 'today') return 'Today';
    if (datePreset === 'yesterday') return 'Yesterday';
    if (datePreset === '7days') return 'Last 7 Days';
    if (datePreset === 'month') return 'This Month';
    if (datePreset === 'custom' && (fromDate || toDate)) {
      return `${fromDate || '...'} to ${toDate || '...'}`;
    }
    return 'All Dates';
  };

  // Sync string date states into the dateRange object used by filter logic
  useEffect(() => {
    const parseDate = (s: string) => s ? new Date(s + 'T00:00:00') : null;
    const to = toDate ? new Date(toDate + 'T23:59:59') : null;
    setDateRange({ from: parseDate(fromDate), to });
  }, [fromDate, toDate]);

  const { data: orders = [], isLoading, error } = useAdminOrders(statusFilter);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const activeFiltersCount = (searchQuery ? 1 : 0) + (statusFilter ? 1 : 0) + (dematStatusFilter ? 1 : 0) + (datePreset === 'custom' && (fromDate || toDate) ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setDematStatusFilter('');
    setFromDate('');
    setToDate('');
    setDatePreset('all');
    setPage(1);
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const saveWidths = useCallback((widths: Record<string, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {}
  }, []);

  const resetAllColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify.success('Column widths reset to default');
  };

  const resetColumnWidth = (key: string) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, [key]: DEFAULT_COLUMN_WIDTHS[key] || 120 };
      saveWidths(updated);
      return updated;
    });
  };

  const resizingColRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const startResizing = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120;
    resizingColRef.current = { key, startX, startWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const active = resizingColRef.current;
      if (!active) return;
      const delta = moveEvent.clientX - active.startX;
      const newWidth = Math.max(45, active.startWidth + delta);
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

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Bulk approval state
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    total: number;
    current: number;
    succeeded: number;
    failed: number;
    errors: { orderId: string; email: string; stockName?: string; error: string }[];
    done: boolean;
  } | null>(null);

  // Edit Transfer Reference No. state (Super Admin only)
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null);
  const [editTransferReferenceNo, setEditTransferReferenceNo] = useState('');
  const [editTransferDate, setEditTransferDate] = useState('');
  const [isEditingTransferReferenceNo, setIsEditingTransferReferenceNo] = useState(false);

  // Bulk review state — rows parsed from CSV awaiting user confirmation
  type BulkReviewRow = { orderId: string; transferReferenceNo: string; transferDate: string; email: string; stockName?: string; error?: string; batchSequence?: string };
  const [bulkReview, setBulkReview] = useState<BulkReviewRow[] | null>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper function to build searchable text from order with safe fallbacks
  const getOrderSearchableText = (order: OrderWithDetails): string => {
    const email = order.user?.email || '';
    const fullName = order.user?.fullName || '';
    const stockName = order.stock?.name || '';
    const stockIsin = order.stock?.isin || '';
    const orderIsin = (order as any).isin || '';
    return `${email} ${fullName} ${stockName} ${stockIsin} ${orderIsin}`.toLowerCase();
  };

  // Filter orders by search query (user email or stock name), and date range
  // Only show orders with completed payment (PAID status only)
  const filteredOrders = orders.filter((order) => {
    const query = debouncedQuery.toLowerCase();
    const searchableText = getOrderSearchableText(order);
    const matchesSearch = searchableText.includes(query);
    const hasCompletedPayment = order.paymentStatus === 'PAID';
    
    // Demat status filtering
    let matchesDematStatus = true;
    if (dematStatusFilter) {
      matchesDematStatus = (order.user?.dematStatus || 'PENDING') === dematStatusFilter;
    }
    
    // Date range filtering
    let matchesDateRange = true;
    if (dateRange.from || dateRange.to) {
      const orderDate = new Date(order.createdAt);
      if (dateRange.from && orderDate < dateRange.from) {
        matchesDateRange = false;
      }
      if (dateRange.to && orderDate > dateRange.to) {
        matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesDateRange && hasCompletedPayment && matchesDematStatus;
  });

  // Paginate filtered orders
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to page 1 and clear selection when search query or filter changes
  useEffect(() => {
    setPage(1);
    setSelectedOrders(new Set());
  }, [debouncedQuery, statusFilter, dematStatusFilter]);

  // Clamp page to valid range when filteredOrders or pageSize changes
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const getStatusOptions = (_currentStatus: string) => {
    // Fully automated — no manual status changes allowed
    return [];
  };

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    await updateMutation.mutateAsync({
      orderId,
      data: { status: newStatus as OrderStatus },
    });
  };

  const handleApprove = async (orderId: string, shareTransferReferenceNo: string, shareTransferDate: string, batchSequence: string) => {
    await updateMutation.mutateAsync({
      orderId,
      data: {
        status: OrderStatus.COMPLETED,
        shareTransferReferenceNo,
        shareTransferDate,
        batchSequence,
      },
    });
  };

  // Handle edit transfer reference no (Super Admin only)
  const handleEditTransferReferenceNo = async () => {
    if (!editingOrder || !editTransferReferenceNo.trim()) return;
    setIsEditingTransferReferenceNo(true);
    try {
      await updateOrderStatus(editingOrder.id, {
        status: editingOrder.status as any,
        shareTransferReferenceNo: editTransferReferenceNo.trim(),
        ...(editTransferDate ? { shareTransferDate: editTransferDate } : {}),
      });
      notify.success('Transfer Reference No. updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setEditingOrder(null);
      setEditTransferReferenceNo('');
      setEditTransferDate('');
    } catch (error: any) {
      notify.error(error.message || 'Failed to update Transfer Reference No.');
    } finally {
      setIsEditingTransferReferenceNo(false);
    }
  };

  // Selection helpers
  const toggleOrder = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelectedOrders(prev => {
      const allPageSelected = pagedOrders.every(o => prev.has(o.id));
      const next = new Set(prev);
      if (allPageSelected) {
        // Deselect all on current page
        pagedOrders.forEach(o => next.delete(o.id));
      } else {
        // Select all on current page
        pagedOrders.forEach(o => next.add(o.id));
      }
      return next;
    });
  }, [pagedOrders]);

  const selectAllFiltered = useCallback(() => {
    setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
  }, [filteredOrders]);

  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  // Derived selection state
  const allPageSelected = pagedOrders.length > 0 && pagedOrders.every(o => selectedOrders.has(o.id));
  const somePageSelected = pagedOrders.some(o => selectedOrders.has(o.id));
  const allFilteredSelected = filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length;

  // Export to Excel (XLSX)
  const exportToExcel = () => {
    if (selectedOrders.size === 0) {
      notify.warning('Please select orders to export.');
      return;
    }

    const ordersToExport = filteredOrders.filter(o => selectedOrders.has(o.id));
    if (ordersToExport.length === 0) return;
    
    const formatDateTime = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).replace(',', '');
    };
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    };

    const headers = [
      'Order ID',
      'CLIENT NAME',
      'Stock Name',
      'ISIN',
      'Quantity',
      'Price Per Share',
      'Consideration Amount',
      'Status',
      'Demat Status',
      'Payment',
      'Date of Receipt',
      'Transaction ID',
      'PAN NO',
      'BO ID',
      'DP ID',
      'CLIENT ID',
      'Mode of Payment',
      'Bank Name',
      'Bank Account Number',
      'Transfer Referance No.',
      'Transfer Date',
      'Batch Sequence'
    ];

    const rows = ordersToExport.map(order => {
      const dematInfo = getDematInfo(order.user);
      const bankInfo = getBankInfo(order.user);
      const dpId = dematInfo.dpId === '—' ? '' : dematInfo.dpId;
      const clientId = dematInfo.clientId === '—' ? '' : dematInfo.clientId;
      const boId = dematInfo.boId === '—' ? '' : dematInfo.boId;
      const panNo = getPanInfo(order.user) === '—' ? '' : getPanInfo(order.user);
      const bankAcNo = bankInfo.accNo === '—' ? '' : bankInfo.accNo;
      const bankName = bankInfo.bankName === '—' ? '' : bankInfo.bankName;

      return [
        order.orderNumber || ``,
        order.user?.fullName || '',
        order.stock?.name || '',
        order.stock?.isin || '',
        order.quantity,
        order.pricePerShare,
        order.totalAmount,
        order.status,
        order.user?.dematStatus || 'PENDING',
        order.paymentStatus,
        formatDateTime(order.createdAt),
        order.cashfreePaymentId || '',
        panNo || '',
        boId || '',
        dpId || '',
        clientId || '',
        '03', // Mode of payment: 03 for Electronic
        bankName,
        bankAcNo,
        order.shareTransferReferenceNo || '',
        order.shareTransferDate ? formatDate(order.shareTransferDate) : '',
        order.batchSequence || '' // Output the batchSequence generated during NSDL batch creation
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    
    const suffix = `_selected_${selectedOrders.size}`;
    XLSX.writeFile(workbook, `orders_export${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // === BULK CSV APPROVAL ===

  const handleBulkCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        notify.error('Spreadsheet has no sheets.');
        return;
      }
      
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        notify.error('Failed to load the first sheet.');
        return;
      }

      // Convert sheet to a 2D array of formatted text strings
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { 
        header: 1,
        raw: false,
        defval: ''
      });

      if (data.length < 2) {
        notify.error('Spreadsheet is empty or has no data rows.');
        return;
      }

      const headerCols = data[0] as string[];
      const orderIdIdx = headerCols.findIndex(h => String(h).toLowerCase().includes('order id'));
      const transferIdIdx = headerCols.findIndex(h => {
        const normalized = String(h).toLowerCase();
        return normalized.includes('transfer reference no') || 
               normalized.includes('transfer referance no') || 
               normalized.includes('transfer id');
      });
      const transferDateIdx = headerCols.findIndex(h => String(h).toLowerCase().includes('transfer date'));
      const emailIdx = headerCols.findIndex(h => {
        const normalized = String(h).toLowerCase();
        return normalized.includes('user email') || normalized.includes('client name');
      });
      const batchSeqIdx = headerCols.findIndex(h => String(h).toLowerCase().includes('batch sequence'));

      if (orderIdIdx === -1 || transferIdIdx === -1 || transferDateIdx === -1 || batchSeqIdx === -1) {
        notify.error('Spreadsheet must have "Order ID", "Transfer Referance No.", "Transfer Date", and "Batch Sequence" columns.');
        return;
      }

      const rowsToApprove: BulkReviewRow[] = [];
      
      const cachedQueries = queryClient.getQueriesData<OrderWithDetails[]>({ queryKey: ['admin', 'orders'] });
      const cachedOrders = cachedQueries.flatMap(([, data]) => data || []);

      for (let i = 1; i < data.length; i++) {
        const cols = data[i];
        if (!cols || cols.length === 0) continue;

        const rawOrderId = String(cols[orderIdIdx] || '').replace(/^'/, '').trim();
        const transferReferenceNo = transferIdIdx >= 0 ? String(cols[transferIdIdx] || '').replace(/^'/, '').trim() : '';
        const rawTransferDate = transferDateIdx >= 0 ? String(cols[transferDateIdx] || '').replace(/^'/, '').trim() : '';
        const batchSequence = batchSeqIdx >= 0 ? String(cols[batchSeqIdx] || '').replace(/^'/, '').trim() : '';
        let email = emailIdx >= 0 ? String(cols[emailIdx] || '') : '';

        if (rawOrderId) {
          let resolvedId = rawOrderId;
          let stockName = undefined;

          // Match by orderNumber first, then fallback ORD-XXXX suffix, then raw id
          const normalizedInput = rawOrderId.toUpperCase();
          // Extract the suffix if input looks like ORD-XXXXXX
          const ordSuffixMatch = normalizedInput.match(/^ORD-([A-Z0-9]+)$/);
          const ordSuffix = ordSuffixMatch ? ordSuffixMatch[1] : null;
          
          let match = orders.find(o => {
            // Direct orderNumber match
            if (o.orderNumber && o.orderNumber.toUpperCase() === normalizedInput) return true;
            // Fallback ORD-XXXX format: compare suffix against last 6 chars of id
            if (ordSuffix && o.id.slice(-ordSuffix.length).toUpperCase() === ordSuffix) return true;
            // Direct database id match (backward compat)
            if (o.id === rawOrderId) return true;
            return false;
          });

          if (!match) {
            match = cachedOrders.find(o => {
              if (o.orderNumber && o.orderNumber.toUpperCase() === normalizedInput) return true;
              if (ordSuffix && o.id.slice(-ordSuffix.length).toUpperCase() === ordSuffix) return true;
              if (o.id === rawOrderId) return true;
              return false;
            });
          }

          if (match) {
            resolvedId = match.id;
            stockName = match.stock?.name || 'Unknown Stock';
            if (match.user) {
              email = match.user.fullName || match.user.email || email;
            }
          }

          if (!transferReferenceNo || !rawTransferDate || !batchSequence) {
            rowsToApprove.push({
              orderId: resolvedId,
              transferReferenceNo,
              transferDate: rawTransferDate,
              email,
              stockName,
              batchSequence,
              error: 'Missing required values (Batch Sequence, Transfer Ref No, or Transfer Date).'
            });
            continue;
          }

          let transferDate = '';
          if (rawTransferDate) {
            // Attempt to parse standard date formats
            let dateObj: Date | null = null;
            
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawTransferDate)) {
              dateObj = new Date(rawTransferDate);
            } else {
              const dmyMatch = rawTransferDate.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
              if (dmyMatch) {
                const day = parseInt(dmyMatch[1]!, 10);
                const month = parseInt(dmyMatch[2]!, 10);
                const year = parseInt(dmyMatch[3]!, 10);
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  dateObj = new Date(year, month - 1, day);
                }
              }
            }

            if (!dateObj || isNaN(dateObj.getTime())) {
              const parsed = new Date(rawTransferDate);
              if (!isNaN(parsed.getTime())) {
                dateObj = parsed;
              }
            }

            if (!dateObj || isNaN(dateObj.getTime())) {
              rowsToApprove.push({
                orderId: resolvedId,
                transferReferenceNo,
                transferDate: '',
                email,
                stockName,
                batchSequence,
                error: 'Invalid date format. Use DD/MM/YYYY or YYYY-MM-DD.'
              });
              continue;
            }

            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            transferDate = `${y}-${m}-${d}`;
          }

          if (!match) {
            rowsToApprove.push({
              orderId: resolvedId,
              transferReferenceNo,
              transferDate,
              email,
              stockName,
              batchSequence,
              error: 'Order not found.'
            });
          } else {
            if (match.status === 'COMPLETED' && !batchSequence) {
              rowsToApprove.push({
                orderId: resolvedId,
                transferReferenceNo,
                transferDate,
                email,
                stockName,
                batchSequence,
                error: 'Order is already approved and completed.'
              });
            } else if (!['PENDING', 'PAID', 'COMPLETED'].includes(match.status)) {
              rowsToApprove.push({
                orderId: resolvedId,
                transferReferenceNo,
                transferDate,
                email,
                stockName,
                batchSequence,
                error: `Order cannot be processed (current status: ${match.status}).`
              });
            } else {
              const orderDate = new Date(match.createdAt);
              if (transferDate) {
                const tDate = new Date(transferDate);
                if (orderDate.getFullYear() !== tDate.getFullYear()) {
                  rowsToApprove.push({
                    orderId: resolvedId,
                    transferReferenceNo,
                    transferDate,
                    email,
                    stockName,
                    batchSequence,
                    error: `Transfer date year (${tDate.getFullYear()}) doesn't match order year (${orderDate.getFullYear()}).`
                  });
                  continue;
                }
              }
              rowsToApprove.push({ orderId: resolvedId, transferReferenceNo, transferDate, email, stockName, batchSequence });
            }
          }
        }
      }

      if (rowsToApprove.length === 0) {
        notify.warning('No valid rows found to process.');
        return;
      }

      setBulkReview(rowsToApprove);
    } catch (err: any) {
      notify.error(`Failed to parse file: ${err.message}`);
    }
  };

  const executeBulkApprove = async () => {
    if (!bulkReview) return;
    const rowsToApprove = bulkReview;
    setBulkReview(null);
    try {
      const progress = {
        active: true,
        total: rowsToApprove.length,
        current: 0,
        succeeded: 0,
        failed: 0,
        errors: [] as { orderId: string; email: string; stockName?: string; error: string }[],
        done: false,
      };
      setBulkProgress({ ...progress });

      for (const row of rowsToApprove) {
        if (row.error) {
          progress.failed++;
          progress.errors.push({
            orderId: row.orderId,
            email: row.email,
            stockName: row.stockName,
            error: row.error,
          });
          progress.current++;
          setBulkProgress({ ...progress });
          continue;
        }

        try {
          if (row.transferReferenceNo && row.transferDate) {
            await updateOrderStatus(row.orderId, {
              status: 'COMPLETED' as any,
              shareTransferReferenceNo: row.transferReferenceNo,
              shareTransferDate: row.transferDate,
              batchSequence: row.batchSequence ? String(row.batchSequence) : undefined,
            });
          }
          progress.succeeded++;
        } catch (err: any) {
          progress.failed++;
          progress.errors.push({
            orderId: row.orderId,
            email: row.email,
            stockName: row.stockName,
            error: err.message || 'Unknown error',
          });
        }
        progress.current++;
        setBulkProgress({ ...progress });
      }

      progress.done = true;
      progress.active = false;
      setBulkProgress({ ...progress });

      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });

      if (progress.failed === 0) {
        notify.success(`All ${progress.succeeded} orders approved successfully!`);
      } else {
        notify.warning(`${progress.succeeded} approved, ${progress.failed} failed. See details below.`);
      }
    } catch (err: any) {
      notify.error(`Failed to parse CSV: ${err.message}`);
    }
  };

  // Enforced status badge design system
  const renderStatusBadge = (status: string) => {
    let classes = "";
    switch (status) {
      case "COMPLETED":
      case "SUCCESS":
        classes = "bg-[#ECFDF5] text-[#16A34A] border-1 border-[#16A34A]/20";
        break;
      case "PROCESSING":
      case "PAID":
        classes = "bg-[#EFF6FF] text-[#2563EB] border-1 border-[#2563EB]/20";
        break;
      case "PENDING":
        classes = "bg-[#FFFBEB] text-[#D97706] border-1 border-[#D97706]/20";
        break;
      case "FAILED":
      case "USER_DROPPED":
      case "CANCELLED":
      case "EXPIRED":
      case "DECLINED":
        classes = "bg-[#FEF2F2] text-[#DC2626] border-1 border-[#DC2626]/20";
        break;
      default:
        classes = "bg-neutral-150 text-neutral-600 border-1 border-neutral-200/40";
    }

    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", classes)}>
        {status}
      </span>
    );
  };

  if (!canUpdate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Order Management</span> permission required to view or manage orders.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Order Management</h1>
        <p className="text-xs font-medium text-[#64748B] mt-0.5">
          {canUpdate ? 'View and manage all orders in the system' : 'View all orders in the system'}
        </p>
      </div>

      {/* CSV Bulk Review Dialog */}
      <Dialog open={!!bulkReview} onOpenChange={(open) => { if (!open) setBulkReview(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-white rounded-[24px] border border-neutral-200/40 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#0F172A]">
              <AlertTriangle size={18} className="text-amber-500" />
              Review Bulk Approval
            </DialogTitle>
          </DialogHeader>

          {bulkReview && (() => {
            const valid = bulkReview.filter(r => !r.error);
            const invalid = bulkReview.filter(r => !!r.error);
            return (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-4">
                {/* Summary */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-[#ECFDF5] border border-[#16A34A]/10 p-3 text-center">
                    <p className="text-2xl font-bold text-[#16A34A]">{valid.length}</p>
                    <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wider mt-0.5">Will be approved</p>
                  </div>
                  {invalid.length > 0 && (
                    <div className="flex-1 rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{invalid.length}</p>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-0.5">Will be skipped (errors)</p>
                    </div>
                  )}
                </div>

                {/* Valid rows */}
                {valid.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-[#16A34A]" /> Orders to approve
                    </p>
                    <div className="rounded-[16px] border border-neutral-200/40 overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#FAFBFC] border-b border-neutral-100">
                          <tr>
                            <th className="px-4 py-2 font-semibold text-[#64748B]">Stock</th>
                            <th className="px-4 py-2 font-semibold text-[#64748B]">User</th>
                            <th className="px-4 py-2 font-semibold text-[#64748B]">Transfer Referance No.</th>
                            <th className="px-4 py-2 font-semibold text-[#64748B]">Transfer Date</th>
                            <th className="px-4 py-2 font-semibold text-[#64748B]">Batch Seq.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {valid.map((row, i) => (
                            <tr key={i} className="hover:bg-neutral-50/50">
                              <td className="px-4 py-2">
                                <p className="font-medium text-[#0F172A]">{row.stockName || '—'}</p>
                                <p className="text-[10px] font-mono text-[#64748B] uppercase">{row.orderId}</p>
                              </td>
                              <td className="px-4 py-2 text-[#64748B]">{row.email}</td>
                              <td className="px-4 py-2 font-mono text-xs font-bold">{row.transferReferenceNo || '—'}</td>
                              <td className="px-4 py-2 text-[#64748B]">{row.transferDate || '—'}</td>
                              <td className="px-4 py-2 text-[#64748B]">{row.batchSequence || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Invalid rows */}
                {invalid.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <XCircle size={14} className="text-red-500" /> Orders with errors (will be skipped)
                    </p>
                    <div className="rounded-[16px] border border-red-100 overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-red-50/30 border-b border-red-100">
                          <tr>
                            <th className="px-4 py-2 font-semibold text-red-600">Stock / User</th>
                            <th className="px-4 py-2 font-semibold text-red-600">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50">
                          {invalid.map((row, i) => (
                            <tr key={i} className="bg-red-50/10">
                              <td className="px-4 py-2">
                                <p className="font-semibold text-red-950">{row.stockName || 'Unknown Stock'}</p>
                                <p className="text-[10px] font-mono text-red-900/60 uppercase">{row.orderId}</p>
                                <p className="text-[10px] text-[#64748B]">{row.email}</p>
                              </td>
                              <td className="px-4 py-2 text-xs font-medium text-red-600">{row.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="pt-3 border-t border-neutral-100">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setBulkReview(null)}
              className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 rounded-full font-semibold text-xs px-4 h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={executeBulkApprove}
              disabled={!bulkReview || bulkReview.filter(r => !r.error).length === 0}
              className="bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-full font-bold text-xs px-4 h-9"
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              Confirm &amp; Approve {bulkReview?.filter(r => !r.error).length ?? 0} Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Progress Overlay */}
      {bulkProgress && (
        <div className="bg-white border border-neutral-200/40 rounded-[20px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {bulkProgress.active ? (
                <Loader2 size={18} className="animate-spin text-[#16A34A]" />
              ) : bulkProgress.failed === 0 ? (
                <CheckCircle2 size={18} className="text-[#16A34A]" />
              ) : (
                <XCircle size={18} className="text-red-500" />
              )}
              <div>
                <p className="font-bold text-sm text-[#0F172A]">
                  {bulkProgress.active
                    ? `Processing ${bulkProgress.current} / ${bulkProgress.total}...`
                    : `Bulk Approval Complete`}
                </p>
                <p className="text-xs font-semibold text-[#64748B]">
                  {bulkProgress.succeeded} succeeded
                  {bulkProgress.failed > 0 && `, ${bulkProgress.failed} failed`}
                </p>
              </div>
            </div>
            {bulkProgress.done && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setBulkProgress(null)}
                className="h-8 px-2 text-[#64748B] hover:text-[#0F172A] rounded-lg"
              >
                <X size={14} />
                <span className="ml-1 text-xs">Dismiss</span>
              </Button>
            )}
          </div>

          <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                bulkProgress.failed > 0 ? 'bg-amber-500' : 'bg-[#16A34A]'
              }`}
              style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
            />
          </div>

          {bulkProgress.errors.length > 0 && bulkProgress.done && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-red-100 bg-red-50/30 p-3.5 space-y-2">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Failed Orders Summary:</p>
              {bulkProgress.errors.map((err, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-b border-red-100/50 pb-2 last:border-0 last:pb-0 text-xs">
                  <div className="flex items-center gap-2">
                    <XCircle size={12} className="text-red-500 shrink-0" />
                    <span className="font-semibold text-[#0F172A]">
                      {err.stockName || err.email || 'Unknown Order'}
                    </span>
                    {err.stockName && err.email && (
                      <span className="text-[10px] text-[#64748B]">({err.email})</span>
                    )}
                  </div>
                  <p className="text-[11px] text-red-600 pl-4">{err.error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cashfree Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Date Preset Dropdown & Search/Filter Popover */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cashfree Date Range Picker */}
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            preset={datePreset}
            onApply={({ fromDate: newFrom, toDate: newTo, preset: newPreset }) => {
              setFromDate(newFrom);
              setToDate(newTo);
              setDatePreset(newPreset);
              setPage(1);
            }}
          />

          {/* [ Search & Filter ⌄ ] Popover */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-10 px-4 bg-white border rounded-lg text-xs font-medium shadow-xs flex items-center gap-2 cursor-pointer transition-colors outline-none",
                  hasActiveFilters
                    ? "border-[#16A34A] text-[#16A34A] bg-[#ECFDF5]/60"
                    : "border-[#E5E7EB] hover:border-[#D1D5DB] text-[#374151]"
                )}
              >
                <span>Search & Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#16A34A] text-white text-[10px] font-bold rounded-full leading-none">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown size={14} className={hasActiveFilters ? "text-[#16A34A]" : "text-[#6B7280]"} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 sm:w-96 p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xl space-y-3.5 z-50"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                <span className="text-xs font-bold text-[#111827]">Filter & Search Orders</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[11px] font-semibold text-[#DC2626] hover:underline cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Search keyword */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#374151]">Search keyword</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-[#9CA3AF]" />
                  <Input
                    placeholder="Email, name, stock, ISIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 rounded-lg border-[#E5E7EB] text-xs font-medium focus-visible:ring-[#16A34A]"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#374151]">Order Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {/* Demat Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#374151]">Demat Status</label>
                <select
                  value={dematStatusFilter}
                  onChange={(e) => { setDematStatusFilter(e.target.value); setPage(1); }}
                  className="w-full h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
                >
                  <option value="">All Demat Statuses</option>
                  <option value="PENDING">Demat Pending</option>
                  <option value="VERIFIED">Demat Verified</option>
                </select>
              </div>

              {/* Custom Date Range */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#374151]">Custom Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[#6B7280] block mb-0.5">From</span>
                    <DatePicker
                      value={fromDate}
                      onChange={(d) => { setFromDate(d); setDatePreset('custom'); setPage(1); }}
                      placeholder="Start date"
                      className="h-8 rounded-lg border-[#E5E7EB] text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7280] block mb-0.5">To</span>
                    <DatePicker
                      value={toDate}
                      onChange={(d) => { setToDate(d); setDatePreset('custom'); setPage(1); }}
                      placeholder="End date"
                      className="h-8 rounded-lg border-[#E5E7EB] text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F3F4F6] flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                  className="h-8 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Apply Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Active Filter Chips */}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3F4F6] text-[#374151] text-xs font-medium">
              <span>"{searchQuery}"</span>
              <button onClick={() => setSearchQuery('')} className="hover:text-red-600 cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}
          {statusFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-xs font-medium">
              <span>Status: {statusFilter}</span>
              <button onClick={() => setStatusFilter('')} className="hover:text-red-600 cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}
          {dematStatusFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] text-[#D97706] text-xs font-medium">
              <span>Demat: {dematStatusFilter}</span>
              <button onClick={() => setDematStatusFilter('')} className="hover:text-red-600 cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}
          {selectedOrders.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-md bg-[#ECFDF5] border border-[#16A34A]/20 px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
                {selectedOrders.size} selected
              </span>
              <button 
                onClick={clearSelection} 
                className="text-xs text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions (Bulk Approve & Green Export Button) */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => bulkFileInputRef.current?.click()}
            variant="outline"
            className="h-10 px-4 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] font-medium text-xs rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            disabled={bulkProgress?.active}
          >
            <Upload size={14} />
            Bulk Approve CSV/Excel
          </Button>
          <input
            ref={bulkFileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            onChange={handleBulkCSVUpload}
          />

          <Button 
            onClick={exportToExcel} 
            className="h-10 px-5 bg-[#16A34A] hover:bg-[#15803D] active:bg-[#166534] text-white font-medium text-xs rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            {selectedOrders.size > 0 ? `Export (${selectedOrders.size})` : 'Export'}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <AdminTableSkeleton rows={10} columns={9} showActions={false} />}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200/40 rounded-[24px]">
          <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
          <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Error Loading Orders</h2>
          <p className="text-sm font-medium text-[#64748B]">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200/40 rounded-[24px]">
          <div className="text-center p-6 flex flex-col items-center">
            <XCircle className="h-8 w-8 text-[#64748B]/40 mb-3" />
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">No Orders Found</h2>
            <p className="text-sm font-medium text-[#64748B] max-w-sm">
              {searchQuery || statusFilter
                ? 'No orders match your search criteria or filter.'
                : 'No orders have been placed yet.'}
            </p>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {!isLoading && !error && filteredOrders.length > 0 && (
        <div className="rounded-xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
          {/* Card Subheader with Reset Widths & Show per page */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E5E7EB] bg-white">
            <button
              onClick={resetAllColumnWidths}
              className="text-[11px] font-medium text-[#6B7280] hover:text-[#111827] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset all column widths to default"
            >
              <RotateCcw size={12} />
              Reset column widths
            </button>

            <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-[#E5E7EB] rounded-md px-2 py-1 text-xs font-semibold text-[#111827] bg-white focus:outline-none focus:ring-1 focus:ring-[#16A34A] cursor-pointer"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          {/* Table with horizontal scrolling and Excel-like resizable columns */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <colgroup>
                {COLUMNS_CONFIG.map((col) => (
                  <col
                    key={col.key}
                    style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px` }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {COLUMNS_CONFIG.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px` }}
                      className={cn(
                        "relative px-3 py-2.5 border-r border-b border-[#E5E7EB] last:border-r-0 text-[12px] font-semibold text-[#374151] select-none whitespace-nowrap overflow-hidden text-ellipsis",
                        col.align === 'right' && "text-right",
                        col.align === 'center' && "text-center"
                      )}
                    >
                      {col.key === 'select' ? (
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                          onCheckedChange={toggleAllOnPage}
                          aria-label="Select all orders on page"
                          className="border-neutral-300 translate-y-[2px]"
                        />
                      ) : (
                        <span title={col.label}>{col.label}</span>
                      )}
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
                {pagedOrders.map((order) => {
                  const dematInfo = getDematInfo(order.user);
                  const panNo = getPanInfo(order.user);
                  const isSelected = selectedOrders.has(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "hover:bg-[#F9FAFB] transition-colors duration-150 text-[12px]",
                        isSelected && "bg-[#ECFDF5]/20 hover:bg-[#ECFDF5]/30"
                      )}
                    >
                      {/* Select Checkbox */}
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOrder(order.id)}
                          aria-label={`Select order ${order.id.slice(-10).toUpperCase()}`}
                          className="border-neutral-300 translate-y-[2px]"
                        />
                      </td>

                      {/* Order ID */}
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#111827]">
                        {(() => {
                          const orderIdText = order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`;
                          const isCopied = copiedOrderId === orderIdText;
                          return (
                            <div className="group/oid flex items-center gap-1.5 min-w-0">
                              <span className="truncate" title={orderIdText}>
                                {orderIdText}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyOrderId(orderIdText, e)}
                                className="opacity-0 group-hover/oid:opacity-100 transition-opacity p-0.5 text-[#16A34A] hover:text-[#15803D] hover:bg-[#ECFDF5] rounded shrink-0 cursor-pointer"
                                title="Copy Order ID"
                              >
                                {isCopied ? (
                                  <Check size={13} className="text-[#16A34A]" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Client Name */}
                      <td className="px-3 py-2.5 font-medium text-[#1F2937] truncate" title={order.user?.fullName || '—'}>
                        {order.user?.fullName || '—'}
                      </td>

                      {/* Stock Name */}
                      <td className="px-3 py-2.5 font-medium text-[#1F2937] truncate" title={order.stock?.name || '—'}>
                        {order.stock?.name || '—'}
                      </td>

                      {/* ISIN */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={order.stock?.isin || '—'}>
                        {order.stock?.isin || '—'}
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#111827] truncate" title={String(order.quantity)}>
                        {order.quantity.toLocaleString('en-IN')}
                      </td>

                      {/* Price Per Share */}
                      <td className="px-3 py-2.5 text-right font-mono text-[#4B5563] truncate" title={`₹ ${order.pricePerShare.toFixed(2)}`}>
                        ₹ {order.pricePerShare.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Total Amount */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#111827] truncate" title={`₹ ${order.totalAmount.toFixed(2)}`}>
                        ₹ {order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {renderStatusBadge(order.status)}
                          {order.status === 'PAID' && canUpdate && (
                            <ApproveOrderDialog
                              order={order}
                              onApprove={(tid, tdate, batchSeq) => handleApprove(order.id, tid, tdate, batchSeq)}
                              isSubmitting={updateMutation.isPending}
                            />
                          )}
                        </div>
                      </td>

                      {/* Demat Status */}
                      <td className="px-3 py-2">
                        {order.user?.dematStatus ? renderStatusBadge(order.user.dematStatus) : <span className="text-[#9CA3AF]">—</span>}
                      </td>

                      {/* Payment Status */}
                      <td className="px-3 py-2">
                        {order.paymentStatus ? renderStatusBadge(order.paymentStatus) : <span className="text-[#9CA3AF]">—</span>}
                      </td>

                      {/* Created At / Date & Time */}
                      <td className="px-3 py-2.5 text-[#4B5563] truncate" title={new Date(order.createdAt).toLocaleString('en-IN')}>
                        {formatCashfreeDateTime(order.createdAt)}
                      </td>

                      {/* Cashfree Payment ID / Transaction ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={order.cashfreePaymentId || ''}>
                        {order.cashfreePaymentId || <span className="text-[#9CA3AF]">—</span>}
                      </td>

                      {/* PAN NO */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={panNo}>
                        {panNo === '—' ? <span className="text-[#9CA3AF]">—</span> : panNo}
                      </td>

                      {/* BO ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={dematInfo.boId}>
                        {dematInfo.boId === '—' ? <span className="text-[#9CA3AF]">—</span> : dematInfo.boId}
                      </td>

                      {/* DP ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={dematInfo.dpId}>
                        {dematInfo.dpId === '—' ? <span className="text-[#9CA3AF]">—</span> : dematInfo.dpId}
                      </td>

                      {/* CLIENT ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#4B5563] truncate" title={dematInfo.clientId}>
                        {dematInfo.clientId === '—' ? <span className="text-[#9CA3AF]">—</span> : dematInfo.clientId}
                      </td>

                      {/* Transfer Reference No. */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {order.shareTransferReferenceNo ? (
                            <code className="text-[11px] font-mono font-semibold text-[#111827] truncate" title={order.shareTransferReferenceNo}>
                              {order.shareTransferReferenceNo}
                            </code>
                          ) : (
                            <span className="text-[11px] text-[#9CA3AF]">—</span>
                          )}
                          {hasEditTransferPermission && (
                            <button
                              onClick={() => {
                                setEditingOrder(order);
                                setEditTransferReferenceNo(order.shareTransferReferenceNo || '');
                                setEditTransferDate(order.shareTransferDate ? new Date(order.shareTransferDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                              }}
                              className="p-1 rounded hover:bg-neutral-100 text-[#6B7280] hover:text-[#111827] transition-colors shrink-0 cursor-pointer"
                              title={order.shareTransferReferenceNo ? "Edit Transfer Reference No." : "Set Transfer Reference No."}
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Transfer Date */}
                      <td className="px-3 py-2.5 text-[#4B5563] truncate" title={order.shareTransferDate ? new Date(order.shareTransferDate).toLocaleDateString('en-IN') : ''}>
                        {order.shareTransferDate ? new Date(order.shareTransferDate).toLocaleDateString('en-IN') : <span className="text-[#9CA3AF]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Select All Filtered Banner */}
      {!isLoading && !error && allPageSelected && !allFilteredSelected && filteredOrders.length > pageSize && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[#16A34A]/20 bg-[#ECFDF5]/50 px-4 py-2.5 text-xs text-[#16A34A] font-semibold">
          <span>All {pagedOrders.length} orders on this page are selected.</span>
          <button
            onClick={selectAllFiltered}
            className="font-bold underline underline-offset-2 hover:text-[#0F172A] transition-colors"
          >
            Select all {filteredOrders.length} orders
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !error && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-xs font-medium text-[#64748B]">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-neutral-200 disabled:hover:text-[#64748B] transition-all duration-200"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-8 h-8 text-xs font-bold rounded-lg border transition-all duration-200",
                      pageNum === page
                        ? "bg-[#16A34A] border-[#16A34A] text-white"
                        : "bg-white border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A]"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-neutral-200 disabled:hover:text-[#64748B] transition-all duration-200"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Transfer ID Dialog (Super Admin only) */}
      {hasEditTransferPermission && editingOrder && (
        <Dialog open={!!editingOrder} onOpenChange={(open) => { if (!open) { setEditingOrder(null); setEditTransferReferenceNo(''); setEditTransferDate(''); } }}>
          <DialogContent className="sm:max-w-[425px] rounded-[24px] bg-white border border-neutral-200/40 p-6 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#0F172A]">Edit Transfer Reference No.</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs font-medium">
              <div className="p-3 bg-[#FAFBFC] border border-neutral-200/40 rounded-xl space-y-1">
                <p className="text-[#0F172A]">
                  Order: <code className="font-mono font-bold">{editingOrder.id.slice(-10).toUpperCase()}</code>
                </p>
                <p className="text-[#64748B]">
                  Stock: {editingOrder.stock?.name || '—'} · User: {editingOrder.user?.email || '—'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="editTransferReferenceNo" className="text-xs font-bold text-[#0F172A]">Transfer Reference No.</label>
                <Input
                  id="editTransferReferenceNo"
                  value={editTransferReferenceNo}
                  onChange={(e) => setEditTransferReferenceNo(e.target.value)}
                  placeholder="e.g. REF12345678"
                  className="w-full rounded-xl border border-neutral-200/60 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] outline-none transition-all h-10 px-3 bg-white text-[#0F172A] text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="editTransferDate" className="text-xs font-bold text-[#0F172A]">Transfer Date</label>
                <DatePicker
                  value={editTransferDate}
                  onChange={(val) => setEditTransferDate(val)}
                  className="w-full rounded-xl border border-neutral-200/60 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] outline-none transition-all h-10 px-3 bg-white text-[#0F172A] text-sm"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
              <Button 
                variant="outline" 
                onClick={() => { setEditingOrder(null); setEditTransferReferenceNo(''); setEditTransferDate(''); }}
                className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 rounded-full font-semibold text-xs px-4 h-9"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditTransferReferenceNo} 
                disabled={isEditingTransferReferenceNo || !editTransferReferenceNo.trim()}
                className="bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-full font-bold text-xs px-4 h-9"
              >
                {isEditingTransferReferenceNo ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
