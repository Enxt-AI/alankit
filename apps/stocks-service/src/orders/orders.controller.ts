import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { GenerateESignSessionDto } from './dto/generate-esign-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminOrOperationJwtAuthGuard } from '../auth/guards/admin-or-operation-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Orders Controller
 * Handles HTTP endpoints for order management
 * Base route: /api/orders
 */
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // USER ENDPOINTS (Require user authentication)
  /**
   * POST /api/orders
   * Create new order (authenticated user)
   * Accepts either stockId or basketId (exactly one required)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    const userId = req.user.userId;
    return await this.ordersService.createOrder(dto, userId);
  }

  /**
   * GET /api/orders/my-orders
   * Get all orders for logged-in user
   */
  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@Req() req: any) {
    const userId = req.user.userId;
    return await this.ordersService.getUserOrders(userId);
  }

  /**
   * GET /api/orders/:id/invoice
   * Download the invoice PDF for a COMPLETED order (authenticated user, own orders only).
   * Returns the PDF as an application/pdf attachment.
   * NOTE: Must be declared BEFORE GET ':id' to prevent the wildcard from swallowing it.
   */
  @Get(':id/deal-sheet')
  @UseGuards(JwtAuthGuard)
  async downloadSignedDealSheet(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const pdf = await this.ordersService.downloadSignedDealSheet(id, req.user.userId);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="signed-deal-sheet-${id.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`);
    res.header('Cache-Control', 'private, no-store');
    res.header('Content-Length', pdf.length);
    res.send(pdf);
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  async downloadInvoice(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const userId = req.user.userId;
    const pdfBuffer = await this.ordersService.generateInvoice(id, userId);
    
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.header('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * GET /api/orders/:id/receipt
   * Download the Payment Receipt Advice PDF for any order (authenticated user, own orders only).
   * Available immediately — no status restriction unlike invoice.
   * NOTE: Must be declared BEFORE GET ':id'.
   */
  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  async downloadReceipt(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const userId = req.user.userId;
    const pdfBuffer = await this.ordersService.generateReceipt(id, userId);

    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
    res.header('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * GET /api/orders/:id
   * Get single order by ID (user can only access their own orders)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrderById(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return await this.ordersService.getOrderById(id, userId);
  }

  /**
   * POST /api/orders/generate-esign-session
   * Generates a Digitap eSign session without requiring an order (sign-first flow).
   * Accepts stock/basket details in the body to fill the Deal Sheet PDF.
   */
  @Post('generate-esign-session')
  @UseGuards(JwtAuthGuard)
  async generateESignSession(@Body() dto: GenerateESignSessionDto, @Req() req: any, @Headers('x-idempotency-key') requestId: string) {
    const userId = req.user.userId;
    return await this.ordersService.generateESignSession(userId, dto, requestId);
  }

  /**
   * POST /api/orders/:id/generate-esign
   * Generates a Digitap eSign session for the given order
   */
  @Post(':id/generate-esign')
  @UseGuards(JwtAuthGuard)
  async generateESign(@Param('id') id: string, @Req() req: any, @Headers('x-idempotency-key') requestId: string) {
    const userId = req.user.userId;
    return await this.ordersService.generateESign(id, userId, requestId);
  }

  // NOTE: cancelOrder endpoint removed — orders are no longer cancellable.
  // Failed payments leave orders in PENDING state for retry.

  /**
   * POST /api/orders/get-esign-doc
   * Fetches the signed e-Sign document using the docId (for frontend display or polling)
   */
  @Post('get-esign-doc')
  @UseGuards(JwtAuthGuard)
  async getESignDoc(@Body('docId') docId: string, @Req() req: any) {
    if (!docId) {
      throw new BadRequestException('docId is required');
    }
    docId = await this.ordersService.assertESignOwner(docId, req.user.userId);
    return await this.ordersService.getESignDoc(docId);
  }

  /**
   * POST /api/orders/verify-esign-identity
   * Synchronous identity gate — frontend calls this BEFORE creating an order.
   * Calls Digitap's get-esign-doc, runs validateSignerIdentity against KYC,
   * and returns { verdict, reason } so the frontend can block on MISMATCH.
   */
  @Post('verify-esign-identity')
  @UseGuards(JwtAuthGuard)
  async verifyESignIdentity(@Body('docId') docId: string, @Req() req: any) {
    if (!docId) {
      throw new BadRequestException('docId is required');
    }
    const userId = req.user.userId;
    return await this.ordersService.verifyESignIdentity(docId, userId);
  }

  // PUBLIC WEBHOOK ENDPOINTS
  /**
   * POST /api/orders/esign-webhook
   * Digitap automatically POSTs the signed doc details here after signing
   */
  @Post('esign-webhook')
  @Public()
  async handleESignWebhook(@Body() payload: any) {
    return await this.ordersService.handleESignWebhook(payload);
  }

  // ADMIN ENDPOINTS (Require admin authentication)
  /**
   * GET /api/orders/admin/all
   * Get all orders (admin only)
   * Optional query param: ?status=PENDING
   */
  @Get('admin/all')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async getAllOrders(@Query('status') status?: string) {
    return await this.ordersService.getAllOrders(status);
  }

  /**
   * POST /api/orders/reconcile-cashfree
   * Manual Payment Reconciliation Run for a selected target date
   */
  @Post('reconcile-cashfree')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async runManualReconciliation(@Body() body: { date?: string; executedBy?: string }) {
    return await this.ordersService.requestPaymentsReconciliation(body?.date, body?.executedBy || 'ACCOUNTANT');
  }

  /**
   * GET /api/orders/reconciliation-active
   * Get active unreconciled/failed payment records (hides reconciled)
   */
  @Get('reconciliation-active')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async getActiveUnreconciledOrders() {
    return await this.ordersService.getActiveUnreconciledOrders();
  }

  /**
   * GET /api/orders/reconciliation-history
   * Get historical ReconciliationRun audit logs
   */
  @Get('reconciliation-history')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async getReconciliationHistory() {
    return await this.ordersService.getReconciliationHistory();
  }

  /**
   * GET /api/orders/admin/:id
   * Get single order by ID with full details (admin only)
   */
  @Get('admin/:id')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async getOrderByIdAdmin(@Param('id') id: string) {
    return await this.ordersService.getOrderByIdAdmin(id);
  }

  /**
   * PUT /api/orders/admin/:id/status
   * Update order status (admin only)
   */
  @Put('admin/:id/status')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user?.role !== 'SUPER_ADMIN' && user?.permissions && !user.permissions.includes('update_orders')) {
      throw new ForbiddenException('Missing update_orders permission');
    }
    return await this.ordersService.updateOrderStatus(id, dto);
  }

  // ============================================
  // DISTRIBUTOR ENDPOINTS
  // ============================================

  /**
   * GET /api/orders/distributor/sales
   * Gets all sales attributed to the distributor or branch RMs
   */
  @Get('distributor/sales')
  @UseGuards(JwtAuthGuard)
  async getDistributorSales(@Req() req: any) {
    const distributorId = req.user.distributorId;
    const branchId = req.user.branchId;

    if (
      (req.user.type !== 'DISTRIBUTOR' && req.user.type !== 'BRANCH') ||
      (!distributorId && !branchId)
    ) {
      throw new ForbiddenException('Access denied. Valid distributor or branch token required.');
    }

    const sales = await this.ordersService.getDistributorSales(distributorId, branchId);
    return {
      success: true,
      sales,
      totalSalesCount: sales.length,
      totalSalesAmount: sales.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    };
  }

  /**
   * GET /api/orders/distributor/sales-stats
   * Gets aggregated sales stats for the distributor or branch
   */
  @Get('distributor/sales-stats')
  @UseGuards(JwtAuthGuard)
  async getDistributorSalesStats(@Req() req: any) {
    const distributorId = req.user.distributorId;
    const branchId = req.user.branchId;

    if (
      (req.user.type !== 'DISTRIBUTOR' && req.user.type !== 'BRANCH') ||
      (!distributorId && !branchId)
    ) {
      throw new ForbiddenException('Access denied. Valid distributor or branch token required.');
    }

    const stats = await this.ordersService.getDistributorSalesStats(distributorId, branchId);
    return {
      success: true,
      ...stats
    };
  }
}
