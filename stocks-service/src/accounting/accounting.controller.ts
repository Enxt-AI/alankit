import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateLedgerDto, UpdateLedgerDto } from './dto/create-ledger.dto';
import { CreateVoucherDto, RemarkVoucherDto, UpdateVoucherDto } from './dto/create-voucher.dto';
import { CreateCustomVoucherTypeDto, UpdateCustomVoucherTypeDto } from './dto/create-custom-voucher-type.dto';
import { CreateAccountingPeriodDto, UpdateAccountingPeriodDto } from './dto/accounting-period.dto';
import { AccountingJwtAuthGuard } from '../auth/guards/accounting-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';

/**
 * Accounting Controller
 * All endpoints guarded by admin authentication.
 * Base route: /api/accounting
 */
@Controller('accounting')
@UseGuards(AccountingJwtAuthGuard)
export class AccountingController {
  constructor(private accountingService: AccountingService) {}

  // ============================================
  // DASHBOARD STATS
  // ============================================

  /**
   * GET /api/accounting/stats
   * Get dashboard statistics
   */
  @Get('stats')
  async getStats() {
    return this.accountingService.getStats();
  }

  /**
   * GET /api/accounting/trial-balance
   * Computes the trial balance via Postgres aggregate
   */
  @Get('trial-balance')
  async getTrialBalance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.accountingService.getTrialBalance({ dateFrom, dateTo });
  }

  /**
   * GET /api/accounting/ledger-entries
   * Get all posted voucher entries in 15-column ledger format
   */
  @Get('ledger-entries')
  async getLedgerEntries(
    @Query('type') type?: string,
    @Query('ledgerType') ledgerType?: string,
    @Query('ledgerId') ledgerId?: string,
    @Query('isin') isin?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.getLedgerEntries({
      type,
      ledgerType,
      ledgerId,
      isin,
      dateFrom,
      dateTo,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ============================================
  // LEDGER ENDPOINTS
  // ============================================

  /**
   * POST /api/accounting/ledgers
   * Create a new ledger
   */
  @Post('ledgers')
  async createLedger(@Body() dto: CreateLedgerDto) {
    return this.accountingService.createLedger(dto);
  }

  // ============================================
  // GROUP ENDPOINTS
  // ============================================

  /**
   * POST /api/accounting/groups
   * Create a new Tally-style accounting group.
   */
  @Post('groups')
  async createGroup(@Body() body: {
    name: string;
    alias?: string;
    under: string;
    isSublLedger?: boolean;
    nettBalance?: boolean;
    usedForCalc?: boolean;
    allocationMethod?: string;
  }) {
    const group = await this.accountingService.createGroup(body);
    return { success: true, group };
  }

  /**
   * GET /api/accounting/groups
   * List all accounting groups.
   */
  @Get('groups')
  async getGroups() {
    const groups = await this.accountingService.fetchGroups();
    return { success: true, groups, count: groups.length };
  }

  /**
   * GET /api/accounting/ledgers
   * List all ledgers (optional query: ?type=BANK|USER&search=...)
   */
  @Get('ledgers')
  async getAllLedgers(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const isActiveOnly = activeOnly !== 'false';
    return this.accountingService.getAllLedgers(type, search, isActiveOnly);
  }

  /**
   * GET /api/accounting/purchase-ledger
   * Returns (or creates) the singleton Purchases A/C control ledger.
   */
  @Get('purchase-ledger')
  async getPurchaseLedger() {
    const ledger = await this.accountingService.ensurePurchaseLedger();
    return { success: true, ledger };
  }

  /**
   * GET /api/accounting/sale-ledger
   * Returns (or creates) the singleton Sales A/C control ledger.
   */
  @Get('sale-ledger')
  async getSaleLedger() {
    const ledger = await this.accountingService.ensureSaleLedger();
    return { success: true, ledger };
  }

  /**
   * GET /api/accounting/bank-ledger
   * Returns (or creates) the singleton Bank A/C control ledger.
   */
  @Get('bank-ledger')
  async getBankLedger() {
    const ledger = await this.accountingService.ensureBankLedger();
    return { success: true, ledger };
  }

  /**
   * POST /api/accounting/ensure-defaults
   * Seeds all 3 system-default ledgers (Sale, Purchase, Bank) if they don't exist.
   * Idempotent — safe to call on every dashboard load.
   */
  @Post('ensure-defaults')
  async ensureDefaults() {
    const result = await this.accountingService.ensureAllDefaultLedgers();
    return { success: true, ...result };
  }

  /**
   * GET /api/accounting/ledgers/:id
   * Get ledger by ID with recent entries
   */
  @Get('ledgers/:id')
  async getLedgerById(@Param('id') id: string) {
    return this.accountingService.getLedgerById(id);
  }

  /**
   * PATCH /api/accounting/ledgers/:id
   * Update a ledger
   */
  @Patch('ledgers/:id')
  async updateLedger(@Param('id') id: string, @Body() dto: UpdateLedgerDto) {
    return this.accountingService.updateLedger(id, dto);
  }

  /**
   * DELETE /api/accounting/ledgers/:id
   * Soft-delete a ledger (set isActive=false)
   */
  @Delete('ledgers/:id')
  async deleteLedger(@Param('id') id: string) {
    return this.accountingService.deleteLedger(id);
  }

  // ============================================
  // CUSTOM VOUCHER TYPE ENDPOINTS
  // ============================================

  @Post('voucher-types')
  async createCustomVoucherType(@Body() dto: CreateCustomVoucherTypeDto) {
    return this.accountingService.createCustomVoucherType(dto);
  }

  @Get('voucher-types')
  async getAllCustomVoucherTypes(@Query('activeOnly') activeOnly?: string) {
    const isActiveOnly = activeOnly !== 'false';
    return this.accountingService.getAllCustomVoucherTypes(isActiveOnly);
  }

  @Patch('voucher-types/:id')
  async updateCustomVoucherType(
    @Param('id') id: string,
    @Body() dto: UpdateCustomVoucherTypeDto,
  ) {
    return this.accountingService.updateCustomVoucherType(id, dto);
  }

  // ============================================
  // VOUCHER ENDPOINTS
  // ============================================

  /**
   * POST /api/accounting/vouchers
   * Create a new voucher with entries
   */
  @Post('vouchers')
  async createVoucher(@Body() dto: CreateVoucherDto, @Req() req: any) {
    const adminId = req.user?.adminId || req.user?.sub || 'unknown';
    return this.accountingService.createVoucher(dto, adminId);
  }

  /**
   * GET /api/accounting/vouchers
   * List all vouchers with filters (type, status, date range, search)
   */
  @Get('vouchers')
  async getAllVouchers(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('customTypeId') customTypeId?: string,
  ) {
    return this.accountingService.getAllVouchers({
      type,
      status,
      dateFrom,
      dateTo,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      customTypeId,
    });
  }

  /**
   * GET /api/accounting/vouchers/:id
   * Get voucher by ID with all entries
   */
  @Get('vouchers/:id')
  async getVoucherById(@Param('id') id: string) {
    return this.accountingService.getVoucherById(id);
  }

  /**
   * PATCH /api/accounting/vouchers/:id/approve
   * Approve a PENDING voucher. Requires Super Admin or approve_vouchers permission.
   */
  @Patch('vouchers/:id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('approve_vouchers')
  async approveVoucher(@Param('id') id: string, @Req() req: any) {
    const approverId = req.user?.adminId || req.user?.sub || 'unknown';
    return this.accountingService.approveVoucher(id, approverId);
  }

  /**
   * PATCH /api/accounting/vouchers/:id/remark
   * Remark (reject) a PENDING voucher with a mandatory note.
   */
  @Patch('vouchers/:id/remark')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('approve_vouchers')
  async remarkVoucher(
    @Param('id') id: string,
    @Body() dto: RemarkVoucherDto,
    @Req() req: any,
  ) {
    const remarkerId = req.user?.adminId || req.user?.sub || 'unknown';
    return this.accountingService.remarkVoucher(id, remarkerId, dto.remark);
  }

  /**
   * PATCH /api/accounting/vouchers/:id
   * Update an existing PENDING or REMARKED voucher. Re-submits back to PENDING.
   */
  @Patch('vouchers/:id')
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.adminId || req.user?.sub || 'unknown';
    return this.accountingService.updateVoucher(id, dto, adminId);
  }

  /**
   * POST /api/accounting/vouchers/:id/reverse
   * Reverse an APPROVED voucher (creates a linked negated APPROVED entry).
   */
  @Post('vouchers/:id/reverse')
  async reverseVoucher(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.adminId || req.user?.sub || 'unknown';
    return this.accountingService.reverseVoucher(id, adminId);
  }

  // ============================================
  // BALANCE RECALCULATION
  // ============================================

  /**
   * PATCH /api/accounting/entries/:id
   * Amend a single voucher entry (narration, qty, rate, amount, remarks).
   * Atomically adjusts the linked ledger balance if amount changes.
   */
  @Patch('entries/:id')
  async amendVoucherEntry(
    @Param('id') id: string,
    @Body() dto: {
      narration?: string;
      qty?: number;
      rate?: number;
      amount?: number;
      remarks?: string;
      metadata?: any;
    },
  ) {
    return this.accountingService.amendVoucherEntry(id, dto);
  }

  /**
   * POST /api/accounting/recalculate-balances
   * Recompute all ledger balances from voucher entries.
   * Fixes any balance drift caused by bugs.
   */
  @Post('recalculate-balances')
  async recalculateBalances() {
    return this.accountingService.recalculateAllBalances();
  }

  // ============================================
  // ACCOUNTING PERIOD LOCK ENDPOINTS
  // ============================================

  @Get('accounting-periods')
  async getAccountingPeriods() {
    return this.accountingService.getAccountingPeriods();
  }

  @Post('accounting-periods')
  async createAccountingPeriod(@Body() dto: CreateAccountingPeriodDto) {
    return this.accountingService.createAccountingPeriod(dto);
  }

  @Patch('accounting-periods/:id')
  async updateAccountingPeriod(
    @Param('id') id: string,
    @Body() dto: UpdateAccountingPeriodDto,
  ) {
    return this.accountingService.updateAccountingPeriod(id, dto);
  }

  @Post('accounting-periods/:id/rollover')
  async rolloverAccountingPeriod(@Param('id') id: string) {
    return this.accountingService.rolloverAccountingPeriod(id);
  }

  @Delete('accounting-periods/:id')
  async deleteAccountingPeriod(@Param('id') id: string) {
    return this.accountingService.deleteAccountingPeriod(id);
  }

  @Get('sun-accounts')
  async getSunAccounts() {
    return this.accountingService.getSunAccounts();
  }

  @Post('sun-accounts')
  async createSunAccount(@Body() dto: { code: string; name: string }) {
    return this.accountingService.createSunAccount(dto);
  }

  @Get('sunsystem/vouchers')
  async getSunsystemVouchers(
    @Query('isBatched') isBatched?: string,
    @Query('batchId') batchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('groupBy') groupBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isBatchedVal = isBatched === 'true' ? true : isBatched === 'false' ? false : undefined;
    return this.accountingService.getSunsystemVouchers({
      isBatched: isBatchedVal,
      batchId,
      dateFrom,
      dateTo,
      search,
      type,
      groupBy: groupBy === 'batch' ? 'batch' : 'voucher',
      page: page ? parseInt(page, 10) || undefined : undefined,
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
    });
  }

  @Post('sunsystem/batch')
  async createSunsystemBatch(
    @Body()
    dto: {
      voucherIds: string[];
      batchId?: string;
      settlementId?: string;
      utrNumber?: string;
      settlementDate?: string;
    },
  ) {
    return this.accountingService.createSunsystemBatch(dto);
  }

  @Post('sunsystem/mark-uploaded')
  async markSunsystemBatchUploaded(@Body() dto: { batchId: string }) {
    return this.accountingService.markSunsystemBatchUploaded(dto);
  }

  @Post('sunsystem/clear-batch')
  async clearSunsystemBatch(@Body() dto: { batchId: string }) {
    return this.accountingService.clearSunsystemBatch(dto);
  }

  // ============================================
  // SETTLEMENT VOUCHERS ENDPOINTS
  // ============================================

  /**
   * GET /api/accounting/settlements
   * Paginated Cashfree bank settlement batches with KPI summary metrics and posted voucher statuses
   */
  @Get('settlements')
  async getBankSettlements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dateFilter') dateFilter?: string,
  ) {
    return this.accountingService.getBankSettlements({
      page: page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      limit: limit ? Math.min(500, Math.max(1, parseInt(limit, 10) || 12)) : 12,
      search,
      status,
      dateFilter,
    });
  }

  @Post('settlements/create-vouchers')
  async createSettlementVouchers(
    @Body() dto: {
      settlementId: string;
      utrNumber: string;
      settlementDate: string;
      paymentDate?: string;
      grossAmount: number;
      totalFee: number;
      totalTax: number;
      netAmount: number;
      bankLedgerId?: string;
    },
    @Req() req: any,
  ) {
    const adminId = req.admin?.id || 'SYSTEM';
    return this.accountingService.recordCashfreeSettlement({
      ...dto,
      adminId,
    });
  }

  @Post('settlements/voucher-status')
  async getSettlementVouchersStatus(@Body() body: { utrNumbers: string[] }) {
    return this.accountingService.getSettlementVouchersStatus(body.utrNumbers || []);
  }

  /**
   * POST /api/accounting/settlements/auto-create
   * Manually trigger auto-creation of pending settlement vouchers
   */
  @Post('settlements/auto-create')
  async triggerAutoCreateSettlementVouchers() {
    return this.accountingService.autoCreatePendingSettlementVouchers();
  }

  /**
   * POST /api/accounting/settlements/sync-utrs
   * Bulk update real UTR numbers from Cashfree CSV
   */
  @Post('settlements/sync-utrs')
  async syncSettlementUtrs(@Body() body: { mappings: { orderId: string; utr: string }[] }) {
    return this.accountingService.syncSettlementUtrs(body.mappings || []);
  }

  /**
   * GET /api/accounting/order-details/:orderId
   * Fetch order pricing & discount breakdown for voucher display
   */
  @Get('order-details/:orderId')
  async getOrderPricingDetails(
    @Param('orderId') orderId: string,
    @Query('instrumentId') instrumentId?: string,
    @Query('stockName') stockName?: string,
    @Query('amount') amount?: string,
    @Query('isin') isin?: string,
  ) {
    return this.accountingService.getOrderPricingDetails(orderId, {
      instrumentId,
      stockName,
      amount: amount ? Number(amount) : undefined,
      isin,
    });
  }

}

