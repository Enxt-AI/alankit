import { stocksApi } from './api-client';

// ============================================
// TYPES
// ============================================

export interface Ledger {
  id: string;
  name: string;
  code?: string;
  sunCode?: string;
  sunName?: string;
  type: 'BANK' | 'USER' | 'STOCK' | 'PURCHASE' | 'SALE';
  openingBalance: number;
  openingBalanceType: 'DR' | 'CR';
  currentBalance: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  phone?: string;
  email?: string;
  pan?: string;
  gstNo?: string;
  tanNo?: string;
  dematAccountNo?: string;
  clientBankAccountNo?: string;
  clientIfscCode?: string;
  address?: string;
  groupId?: string;
  stockId?: string;
  stock?: {
    id: string;
    name: string;
    openingQuantity: number;
    openingRate: number;
    openingValue: number;
  };
  group?: AccountingGroup;
  isActive: boolean;
  metadata?: any;
  user?: { kycStatus: string } | null;
  createdAt: string;
  updatedAt: string;
  voucherEntries?: VoucherEntry[];
}

export interface VoucherEntry {
  id: string;
  voucherId: string;
  ledgerId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  narration?: string;
  scriptName?: string;
  isin?: string;
  qty?: number;
  rate?: number;
  remarks?: string;
  metadata?: any;
  createdAt: string;
  ledger?: { id: string; name: string; type: string; code?: string; sunCode?: string; sunName?: string; stockId?: string; pan?: string; gstNo?: string; address?: string };
  voucher?: {
    id: string;
    voucherNumber: string;
    type: string;
    date: string;
    narration?: string;
    referenceNumber?: string;
    referenceDate?: string;
    adjustmentType?: string;
    totalAmount?: number;
    customTypeId?: string;
    customType?: { id: string; name: string; baseType: string; prefix?: string };
  };
}

export type VoucherStatus = 'PENDING' | 'APPROVED' | 'REMARKED';

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: 'PAYMENT_SALES' | 'RECEIPT' | 'JOURNAL' | 'STOCK_JOURNAL' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
  customTypeId?: string;
  customType?: CustomVoucherType;
  date: string;
  narration?: string;
  referenceNumber?: string;
  referenceDate?: string;
  totalAmount: number;
  branch?: string;
  vertical?: string;
  employeeId?: string;
  employeeName?: string;
  // Approval lifecycle
  status: VoucherStatus;
  approvedById?: string;
  approvedByName?: string; // Resolved admin full name
  approvedAt?: string;
  approvalRemark?: string;
  // Audit
  createdById: string;
  createdByName?: string; // Resolved admin full name
  updatedById?: string;
  adjustmentType?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  entries: VoucherEntry[];
}


export interface CustomVoucherType {
  id: string;
  name: string;
  baseType: 'PAYMENT_SALES' | 'RECEIPT' | 'JOURNAL' | 'STOCK_JOURNAL' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
  prefix?: string;
  needsApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingStats {
  ledgers: { total: number; bank: number; user: number };
  vouchers: {
    total: number;
    byType: Record<string, number>;
  };
  totals: { debit: number; credit: number };
  recentVouchers: Voucher[];
}

// ============================================
// LEDGER API
// ============================================

export async function createLedger(data: {
  name: string;
  type: 'BANK' | 'USER' | 'SALE' | 'PURCHASE' | 'STOCK';
  openingBalance?: number;
  openingBalanceType?: 'DR' | 'CR';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  phone?: string;
  email?: string;
  pan?: string;
  gstNo?: string;
  tanNo?: string;
  dematAccountNo?: string;
  clientBankAccountNo?: string;
  clientIfscCode?: string;
  address?: string;
  groupId?: string;        // optional group assignment
  sunCode?: string;
  sunName?: string;
  openingQuantity?: number;
  openingRate?: number;
}): Promise<Ledger> {
  const response = await stocksApi.post('/accounting/ledgers', data);
  return response.data.ledger;
}

// ============================================
// ACCOUNTING GROUP TYPES & API
// ============================================

export interface AccountingGroup {
  id: string;
  name: string;
  code?: string;
  alias?: string;
  under: string;           // Parent group name (e.g. "Capital Account")
  isSublLedger: boolean;   // Behaves like sub-ledger
  nettBalance: boolean;    // Nett Dr/Cr for reporting
  usedForCalc: boolean;    // Used for calculation (taxes, discounts)
  allocationMethod: string; // Not Applicable | Quantity | Value
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new accounting group (Tally-style group creation).
 */
export async function createGroup(data: {
  name: string;
  code?: string;
  alias?: string;
  under: string;
  isSublLedger?: boolean;
  nettBalance?: boolean;
  usedForCalc?: boolean;
  allocationMethod?: string;
}): Promise<AccountingGroup> {
  const response = await stocksApi.post('/accounting/groups', data);
  return response.data.group;
}

/**
 * Fetch all accounting groups.
 */
export async function fetchGroups(): Promise<{ groups: AccountingGroup[]; count: number }> {
  const response = await stocksApi.get('/accounting/groups');
  return response.data;
}

/**
 * Seed all system-default ledgers (Sale, Purchase, Bank).
 * Uses the pre-existing individual GET endpoints (already compiled) so this
 * works even before the server is restarted. Non-fatal on any failure.
 */
export async function ensureDefaultLedgers(): Promise<void> {
  // Disabled as per user request to not auto-create standard system ledgers.
}

export async function fetchLedgers(
  type?: string,
  search?: string,
  activeOnly?: boolean,
): Promise<{ ledgers: Ledger[]; count: number }> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (search) params.set('search', search);
  if (activeOnly !== undefined) params.set('activeOnly', String(activeOnly));
  const response = await stocksApi.get(
    `/accounting/ledgers?${params.toString()}`,
  );
  return response.data;
}

export async function fetchLedgerById(id: string): Promise<Ledger> {
  const response = await stocksApi.get(`/accounting/ledgers/${id}`);
  return response.data.ledger;
}

export async function updateLedger(
  id: string,
  data: Partial<Ledger> & { openingQuantity?: number; openingRate?: number },
): Promise<Ledger> {
  const response = await stocksApi.patch(`/accounting/ledgers/${id}`, data);
  return response.data.ledger;
}

export async function deleteLedger(id: string): Promise<void> {
  await stocksApi.delete(`/accounting/ledgers/${id}`);
}

/**
 * Toggle the isActive status of a ledger (suspend or reactivate).
 */
export async function suspendLedger(id: string, isActive: boolean): Promise<Ledger> {
  return updateLedger(id, { isActive } as Partial<Ledger>);
}

/**
 * Fetch (or auto-create) the singleton Purchases A/C control ledger.
 * This is the system ledger that accumulates all approved purchase vouchers.
 */
export async function fetchPurchaseLedger(): Promise<Ledger> {
  const response = await stocksApi.get('/accounting/purchase-ledger');
  return response.data.ledger;
}

/**
 * Fetch (or auto-create) the singleton Sales A/C control ledger.
 * This is the system ledger that accumulates all approved sale (PAYMENT_SALES) vouchers.
 */
export async function fetchSaleLedger(): Promise<Ledger> {
  const response = await stocksApi.get('/accounting/sale-ledger');
  return response.data.ledger;
}

/**
 * Amend (edit) a single voucher entry.
 * Editable: narration, qty, rate, amount, remarks.
 * The backend atomically adjusts the ledger balance if amount changes.
 */
export async function updateVoucherEntry(
  entryId: string,
  data: {
    narration?: string;
    qty?: number;
    rate?: number;
    amount?: number;
    remarks?: string;
    metadata?: any;
  },
): Promise<VoucherEntry> {
  const response = await stocksApi.patch(`/accounting/entries/${entryId}`, data);
  return response.data.entry;
}


export async function createVoucher(data: {
  type: string;
  customTypeId?: string;
  adjustmentType?: string;
  date: string;
  narration?: string;
  referenceNumber?: string;
  referenceDate?: string;
  entries: { ledgerId: string; entryType: 'DEBIT' | 'CREDIT'; amount: number; narration?: string; scriptName?: string; isin?: string; qty?: number; rate?: number; remarks?: string; metadata?: any }[];
  metadata?: any;
}): Promise<Voucher> {
  const response = await stocksApi.post('/accounting/vouchers', data);
  return response.data.voucher;
}

export async function fetchVouchers(query?: {
  type?: string;
  customTypeId?: string;
  status?: VoucherStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  vouchers: Voucher[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (query?.type) params.set('type', query.type);
  if (query?.customTypeId) params.set('customTypeId', query.customTypeId);
  if (query?.status) params.set('status', query.status);
  if (query?.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query?.dateTo) params.set('dateTo', query.dateTo);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  const response = await stocksApi.get(
    `/accounting/vouchers?${params.toString()}`,
  );
  return response.data;
}

export async function fetchVoucherById(id: string): Promise<Voucher> {
  const response = await stocksApi.get(`/accounting/vouchers/${id}`);
  return response.data.voucher;
}

export async function approveVoucher(id: string): Promise<Voucher> {
  const response = await stocksApi.patch(`/accounting/vouchers/${id}/approve`);
  return response.data.voucher;
}

export async function remarkVoucher(id: string, remark: string): Promise<Voucher> {
  const response = await stocksApi.patch(`/accounting/vouchers/${id}/remark`, { remark });
  return response.data.voucher;
}

// ============================================
// STATS API
// ============================================

export async function fetchAccountingStats(): Promise<AccountingStats> {
  const response = await stocksApi.get('/accounting/stats');
  return response.data.stats;
}

// ============================================
// LEDGER ENTRIES API (15-column format)
// ============================================

export interface LedgerEntryRow {
  id: string;
  voucherId: string;
  ledgerId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  narration?: string;
  scriptName?: string;
  isin?: string;
  qty?: number;
  rate?: number;
  remarks?: string;
  createdAt: string;
  voucher: {
    id: string;
    voucherNumber: string;
    type: string;
    date: string;
    narration?: string;
    referenceNumber?: string;
    referenceDate?: string;
    totalAmount: number;
    isPosted: boolean;
    adjustmentType?: string;
    metadata?: any;
    customTypeId?: string;
    customType?: { id: string; name: string; baseType: string; prefix?: string };
  };
  ledger: {
    id: string;
    name: string;
    type: string;
    code?: string;
    phone?: string;
    email?: string;
    pan?: string;
    gstNo?: string;
    tanNo?: string;
    dematAccountNo?: string;
    clientBankAccountNo?: string;
    clientIfscCode?: string;
    address?: string;
    stockId?: string;
  };
}

export async function fetchLedgerEntries(query?: {
  type?: string;
  ledgerType?: string;
  ledgerId?: string;
  isin?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  entries: LedgerEntryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (query?.type) params.set('type', query.type);
  if (query?.ledgerType) params.set('ledgerType', query.ledgerType);
  if (query?.ledgerId) params.set('ledgerId', query.ledgerId);
  if (query?.isin) params.set('isin', query.isin);
  if (query?.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query?.dateTo) params.set('dateTo', query.dateTo);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  const response = await stocksApi.get(
    `/accounting/ledger-entries?${params.toString()}`,
  );
  return response.data;
}

export interface TrialBalanceRow {
  id: string;
  type: string;
  ledgerCode?: string;
  ledgerName: string;
  sunCode?: string;
  sunName?: string;
  openingNet: number;
  debit: number;
  credit: number;
  closingNet: number;
}

export async function fetchTrialBalance(query?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  rows: TrialBalanceRow[];
}> {
  const params = new URLSearchParams();
  if (query?.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query?.dateTo) params.set('dateTo', query.dateTo);
  
  const response = await stocksApi.get(
    `/accounting/trial-balance?${params.toString()}`,
  );
  return response.data;
}

// ============================================
// BALANCE RECALCULATION API
// ============================================

export async function recalculateBalances(): Promise<{
  success: boolean;
  message: string;
  updated: { id: string; name: string; oldBalance: number; newBalance: number }[];
  totalChecked: number;
}> {
  const response = await stocksApi.post('/accounting/recalculate-balances');
  return response.data;
}

let fallbackOrdersCache: { data: any[]; fetchedAt: number } | null = null;

export async function fetchBankSettlements(query?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFilter?: string;
}): Promise<{
  success: boolean;
  settlements: {
    settlementId: string;
    utrNumber: string;
    settlementDate: string;
    settlementStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
    orderCount: number;
    grossAmount: number;
    totalFee: number;
    totalTax: number;
    netAmount: number;
    orders: {
      id: string;
      orderNumber: string;
      userName: string;
      userEmail: string;
      itemName: string;
      quantity: number;
      grossAmount: number;
      cfPaymentId: string;
      paymentMode: string;
      paymentTime: string;
      fee: number;
      tax: number;
      netAmount: number;
    }[];
  }[];
  metrics: {
    totalNetSettled: number;
    totalGross: number;
    totalDeductions: number;
    totalCount: number;
    pendingSettlements: number;
  };
  postedUtrs: { utr: string; rcpNumber?: string; jvNumber?: string }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const params = new URLSearchParams();
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.search) params.set('search', query.search);
  if (query?.status) params.set('status', query.status);
  if (query?.dateFilter) params.set('dateFilter', query.dateFilter);
  try {
    const response = await stocksApi.get(`/accounting/settlements?${params.toString()}`);
    return response.data;
  } catch (err: any) {
    if (err?.response?.status !== 404) {
      throw err;
    }

    // Fallback when stocks-service container has not yet deployed GET /accounting/settlements
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query?.limit) || 12));
    const searchQuery = (query?.search || '').trim().toLowerCase();
    const statusFilter = (query?.status || 'ALL').toUpperCase();
    const dateFilter = (query?.dateFilter || 'ALL').toUpperCase();

    const nowMs = Date.now();
    if (!fallbackOrdersCache || nowMs - fallbackOrdersCache.fetchedAt > 30_000) {
      const ordersRes = await stocksApi.get<any[]>('/orders/admin/all');
      fallbackOrdersCache = { data: ordersRes.data || [], fetchedAt: nowMs };
    }
    const orders = fallbackOrdersCache.data;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const settlementMap = new Map<string, any>();

    for (const order of orders) {
      const isPaid = order.paymentStatus === 'PAID' || order.status === 'COMPLETED';
      if (!isPaid) continue;

      const pData = (order.paymentData || {}) as Record<string, any>;
      const hasExplicitWebhookPayout = Boolean(
        pData.transfer_utr || pData.cf_settlement_id || pData.transfer_time,
      );
      const orderDateObj = order.createdAt ? new Date(order.createdAt) : new Date();
      if (!hasExplicitWebhookPayout && orderDateObj >= todayStart) continue;

      const realSettlementKey =
        (pData.cf_settlement_id && String(pData.cf_settlement_id).trim()) ||
        (pData.settlementId && String(pData.settlementId).trim()) ||
        (pData.transfer_utr && String(pData.transfer_utr).trim()) ||
        (pData.settlement_utr && String(pData.settlement_utr).trim());

      if (!realSettlementKey) continue;

      const displaySettlementId = String(pData.cf_settlement_id || pData.settlementId || '').trim();
      const displayUtrNumber = String(
        pData.transfer_utr || pData.settlement_utr || pData.utr || pData.bank_reference || '',
      ).trim();

      if (!displaySettlementId && !displayUtrNumber) continue;

      let settlementDateObj: Date;
      let settlementStatus: 'SUCCESS' | 'PENDING' | 'FAILED' = 'SUCCESS';

      if (hasExplicitWebhookPayout) {
        settlementDateObj = new Date(
          pData.transfer_time || pData.settlement_date || orderDateObj,
        );
        settlementStatus =
          pData.settlement_status === 'PENDING'
            ? 'PENDING'
            : pData.settlement_status === 'FAILED'
            ? 'FAILED'
            : 'SUCCESS';
      } else {
        const tPlusOne = new Date(orderDateObj);
        tPlusOne.setDate(tPlusOne.getDate() + 1);
        if (tPlusOne.getDay() === 0) tPlusOne.setDate(tPlusOne.getDate() + 1);
        if (tPlusOne > todayEnd) {
          settlementDateObj = orderDateObj;
          settlementStatus = 'PENDING';
        } else {
          settlementDateObj = tPlusOne;
          settlementStatus = 'SUCCESS';
        }
      }

      const grossAmount = Number(order.totalAmount || 0);
      const feeRaw =
        pData.service_charge ??
        pData.payment_service_charge ??
        pData.fee ??
        pData.settlement_charge;
      const taxRaw =
        pData.service_tax ??
        pData.payment_service_tax ??
        pData.tax ??
        pData.settlement_tax;

      const fee =
        feeRaw !== undefined && feeRaw !== null && !isNaN(parseFloat(feeRaw))
          ? parseFloat(feeRaw)
          : Math.round(grossAmount * 0.015);
      const tax =
        taxRaw !== undefined && taxRaw !== null && !isNaN(parseFloat(taxRaw))
          ? parseFloat(taxRaw)
          : Math.round(fee * 0.18);
      const netAmount =
        pData.settlement_amount !== undefined &&
        pData.settlement_amount !== null &&
        !isNaN(parseFloat(pData.settlement_amount))
          ? parseFloat(pData.settlement_amount)
          : Number((grossAmount - fee - tax).toFixed(2));

      const cfPaymentId =
        order.cashfreePaymentId || pData.cf_payment_id || `PAY-${String(order.id).slice(0, 8)}`;
      const paymentMode = pData.paymentMethod || pData.payment_group || 'Cashfree PG';
      const paymentTime = order.createdAt
        ? new Date(order.createdAt).toLocaleString('en-IN')
        : '—';
      const itemName = order.stock?.name || order.basket?.name || 'Unlisted Security';

      if (!settlementMap.has(realSettlementKey)) {
        settlementMap.set(realSettlementKey, {
          settlementId: displaySettlementId,
          utrNumber: displayUtrNumber,
          settlementDate: settlementDateObj.toISOString(),
          settlementStatus,
          orderCount: 0,
          grossAmount: 0,
          totalFee: 0,
          totalTax: 0,
          netAmount: 0,
          orders: [],
        });
      }

      const rec = settlementMap.get(realSettlementKey)!;
      rec.orderCount += 1;
      rec.grossAmount = Number((rec.grossAmount + grossAmount).toFixed(2));
      rec.totalFee = Number((rec.totalFee + fee).toFixed(2));
      rec.totalTax = Number((rec.totalTax + tax).toFixed(2));
      rec.netAmount = Number((rec.netAmount + netAmount).toFixed(2));
      rec.orders.push({
        id: order.id,
        orderNumber: order.orderNumber || String(order.id).slice(0, 10).toUpperCase(),
        userName: order.user?.fullName || 'Valued Client',
        userEmail: order.user?.email || 'N/A',
        itemName,
        quantity: Number(order.quantity || 1),
        grossAmount,
        cfPaymentId,
        paymentMode,
        paymentTime,
        fee,
        tax,
        netAmount,
      });
    }

    const allSettlements = Array.from(settlementMap.values()).sort(
      (a, b) => new Date(b.settlementDate).getTime() - new Date(a.settlementDate).getTime(),
    );

    const metrics = {
      totalNetSettled: Number(
        allSettlements
          .filter((s) => s.settlementStatus === 'SUCCESS')
          .reduce((sum, s) => sum + s.netAmount, 0)
          .toFixed(2),
      ),
      totalGross: Number(allSettlements.reduce((sum, s) => sum + s.grossAmount, 0).toFixed(2)),
      totalDeductions: Number(
        allSettlements.reduce((sum, s) => sum + s.totalFee + s.totalTax, 0).toFixed(2),
      ),
      totalCount: allSettlements.length,
      pendingSettlements: allSettlements.filter((s) => s.settlementStatus === 'PENDING').length,
    };

    const filtered = allSettlements.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.settlementId.toLowerCase().includes(searchQuery) ||
        s.utrNumber.toLowerCase().includes(searchQuery) ||
        s.orders.some(
          (o: any) =>
            o.orderNumber.toLowerCase().includes(searchQuery) ||
            String(o.id).toLowerCase().includes(searchQuery) ||
            o.userName.toLowerCase().includes(searchQuery) ||
            o.userEmail.toLowerCase().includes(searchQuery) ||
            o.itemName.toLowerCase().includes(searchQuery) ||
            o.cfPaymentId.toLowerCase().includes(searchQuery) ||
            o.paymentMode.toLowerCase().includes(searchQuery),
        );
      const matchesStatus = statusFilter === 'ALL' || s.settlementStatus === statusFilter;
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const setDate = new Date(s.settlementDate);
        const now = new Date();
        if (dateFilter === 'TODAY') {
          matchesDate = setDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'THIS_WEEK') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          matchesDate = setDate >= weekAgo;
        } else if (dateFilter === 'THIS_MONTH') {
          matchesDate =
            setDate.getMonth() === now.getMonth() && setDate.getFullYear() === now.getFullYear();
        }
      }
      return matchesSearch && matchesStatus && matchesDate;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const settlements = filtered.slice(start, start + limit);

    let postedUtrs: { utr: string; rcpNumber?: string; jvNumber?: string }[] = [];
    const pageUtrs = settlements.map((s) => s.utrNumber).filter(Boolean);
    if (pageUtrs.length > 0) {
      try {
        const statusRes = await fetchSettlementVouchersStatus(pageUtrs);
        postedUtrs = statusRes.postedUtrs || [];
      } catch {}
    }

    return {
      success: true,
      settlements,
      metrics,
      postedUtrs,
      pagination: { page: safePage, limit, total, totalPages },
    };
  }
}

export async function recordCashfreeSettlement(data: {
  settlementId: string;
  utrNumber: string;
  settlementDate: string;
  paymentDate?: string;
  grossAmount: number;
  totalFee: number;
  totalTax: number;
  netAmount: number;
  bankLedgerId?: string;
}): Promise<{
  success: boolean;
  message: string;
  vouchers?: any[];
  alreadyExists?: boolean;
}> {
  const response = await stocksApi.post('/accounting/settlements/create-vouchers', data);
  return response.data;
}

export async function fetchSettlementVouchersStatus(utrNumbers: string[]): Promise<{
  success: boolean;
  postedUtrs: { utr: string; rcpNumber?: string; jvNumber?: string }[];
}> {
  const response = await stocksApi.post('/accounting/settlements/voucher-status', { utrNumbers });
  return response.data;
}

// ============================================
// CUSTOM VOUCHER TYPES API
// ============================================

export async function fetchCustomVoucherTypes(activeOnly?: boolean): Promise<CustomVoucherType[]> {
  const response = await stocksApi.get(`/accounting/voucher-types${activeOnly !== undefined ? `?activeOnly=${activeOnly}` : ''}`);
  return response.data;
}

export async function createCustomVoucherType(data: {
  name: string;
  baseType: 'PAYMENT_SALES' | 'RECEIPT' | 'JOURNAL' | 'STOCK_JOURNAL' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
  prefix?: string;
  needsApproval?: boolean;
}): Promise<CustomVoucherType> {
  const response = await stocksApi.post('/accounting/voucher-types', data);
  return response.data;
}

export async function updateCustomVoucherType(
  id: string,
  data: {
    name?: string;
    baseType?: 'PAYMENT_SALES' | 'RECEIPT' | 'JOURNAL' | 'STOCK_JOURNAL' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
    prefix?: string;
    needsApproval?: boolean;
    isActive?: boolean;
  },
): Promise<CustomVoucherType> {
  const response = await stocksApi.patch(`/accounting/voucher-types/${id}`, data);
  return response.data;
}

export async function updateVoucher(
  id: string,
  data: {
    type?: string;
    customTypeId?: string;
    adjustmentType?: string;
    date?: string;
    narration?: string;
    referenceNumber?: string;
    referenceDate?: string;
    entries?: { ledgerId: string; entryType: 'DEBIT' | 'CREDIT'; amount: number; narration?: string; scriptName?: string; isin?: string; qty?: number; rate?: number; remarks?: string }[];
    metadata?: any;
  },
): Promise<Voucher> {
  const response = await stocksApi.patch(`/accounting/vouchers/${id}`, data);
  return response.data.voucher;
}

export async function reverseVoucher(id: string): Promise<Voucher> {
  const response = await stocksApi.post(`/accounting/vouchers/${id}/reverse`);
  return response.data.voucher;
}

// ============================================
// ACCOUNTING PERIOD LOCK API
// ============================================

export interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  lockStartDate?: string;
  lockEndDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAccountingPeriods(): Promise<AccountingPeriod[]> {
  const response = await stocksApi.get('/accounting/accounting-periods');
  return response.data;
}

export async function createAccountingPeriod(data: {
  name: string;
  startDate: string;
  endDate: string;
  lockStartDate?: string;
  lockEndDate?: string;
}): Promise<AccountingPeriod> {
  const response = await stocksApi.post('/accounting/accounting-periods', data);
  return response.data;
}

export async function updateAccountingPeriod(
  id: string,
  data: {
    name?: string;
    startDate?: string;
    endDate?: string;
    lockStartDate?: string | null;
    lockEndDate?: string | null;
    isActive?: boolean;
  },
): Promise<AccountingPeriod> {
  const response = await stocksApi.patch(`/accounting/accounting-periods/${id}`, data);
  return response.data;
}

export async function rolloverAccountingPeriod(id: string): Promise<AccountingPeriod> {
  const response = await stocksApi.post(`/accounting/accounting-periods/${id}/rollover`);
  return response.data;
}

export async function deleteAccountingPeriod(id: string): Promise<void> {
  await stocksApi.delete(`/accounting/accounting-periods/${id}`);
}

// ============================================
// SUN ACCOUNT API (Database-backed Sun Mappings)
// ============================================

export interface SunAccount {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSunAccounts(): Promise<SunAccount[]> {
  const response = await stocksApi.get('/accounting/sun-accounts');
  return response.data;
}

export async function createSunAccount(data: { code: string; name: string }): Promise<SunAccount> {
  const response = await stocksApi.post('/accounting/sun-accounts', data);
  return response.data;
}

// ============================================
// SUN SYSTEM TRANSFER BATCHES API
// ============================================

export async function fetchSunsystemVouchers(query?: {
  isBatched?: boolean;
  batchId?: string;
  settlementId?: string;
  utrNumber?: string;
  settlementDate?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  type?: string;
  groupBy?: 'batch' | 'voucher';
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  vouchers: Voucher[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  summary?: { count: number; amount: string | number };
}> {
  const params = new URLSearchParams();
  if (query?.isBatched !== undefined) params.set('isBatched', String(query.isBatched));
  if (query?.batchId) params.set('batchId', query.batchId);
  if (query?.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query?.dateTo) params.set('dateTo', query.dateTo);
  if (query?.search) params.set('search', query.search);
  if (query?.type && query.type !== 'All') params.set('type', query.type);
  if (query?.groupBy) params.set('groupBy', query.groupBy);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const response = await stocksApi.get(`/accounting/sunsystem/vouchers?${params.toString()}`);
  return response.data;
}

export async function createSunsystemBatch(data: {
  voucherIds: string[];
  batchId?: string;
  settlementId?: string;
  utrNumber?: string;
  settlementDate?: string;
}): Promise<{ success: boolean; batchId: string; updatedCount: number }> {
  const response = await stocksApi.post('/accounting/sunsystem/batch', data);
  return response.data;
}

export async function markSunsystemBatchUploaded(data: {
  batchId: string;
}): Promise<{ success: boolean; updatedCount: number }> {
  const response = await stocksApi.post('/accounting/sunsystem/mark-uploaded', data);
  return response.data;
}

export async function clearSunsystemBatch(data: {
  batchId: string;
}): Promise<{ success: boolean; clearedCount: number }> {
  const response = await stocksApi.post('/accounting/sunsystem/clear-batch', data);
  return response.data;
}


export async function autoCreatePendingSettlementVouchers(): Promise<{
  success: boolean;
  processed?: number;
}> {
  const res = await stocksApi.post('/accounting/settlements/auto-create');
  return res.data;
}

export async function syncSettlementUtrs(mappings: { orderId: string; utr: string }[]) {
  const res = await stocksApi.post('/accounting/settlements/sync-utrs', { mappings });
  return res.data;
}

/**
 * Fetch order pricing and discount details for voucher display
 */
export async function getOrderPricingDetails(
  orderId: string,
  extra?: {
    instrumentId?: string;
    stockName?: string;
    amount?: number;
    isin?: string;
  }
): Promise<any> {
  try {
    const params = new URLSearchParams();
    if (extra?.instrumentId) params.set('instrumentId', extra.instrumentId);
    if (extra?.stockName) params.set('stockName', extra.stockName);
    if (extra?.amount != null) params.set('amount', String(extra.amount));
    if (extra?.isin) params.set('isin', extra.isin);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await stocksApi.get(`/accounting/order-details/${encodeURIComponent(orderId)}${qs}`);
    return res.data;
  } catch {
    return null;
  }
}

