import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PaymentService } from './payment.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../auth/decorators/public.decorator';
import { authenticateWebhook } from './webhook-auth';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    @InjectQueue('payment-webhooks') private readonly paymentQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'ok',
    };
  }

  @Post(':orderId/create')
  @UseGuards(JwtAuthGuard)
  async createPaymentOrder(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req.user.userId;
    return await this.paymentService.createPaymentOrder(orderId, userId);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(@Body() dto: VerifyPaymentDto, @Req() req: any) {
    const userId = req.user.userId;
    return await this.paymentService.verifyPayment(dto, userId);
  }

  @Post('webhook')
  @HttpCode(200)
  @Public()
  async handleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const signature =
      headers['x-webhook-signature'] ||
      headers['x-cashfree-signature'] ||
      headers['signature'];
    const timestamp =
      headers['x-webhook-timestamp'] ||
      headers['x-cashfree-timestamp'] ||
      headers['timestamp'];

    const jobId = authenticateWebhook(req.rawBody, signature, timestamp,
      this.config.get<string>('CASHFREE_CLIENT_SECRET', ''));
    // Acknowledge only authenticated events successfully persisted to Redis.
    await this.paymentQueue.add('cashfree-event', {
      body,
      signature: signature || 'none',
      timestamp: timestamp || new Date().toISOString(),
      type: body?.type || body?.event,
    }, { jobId });
    
    // Immediately return 200 OK to the gateway
    return { status: 'Received' };
  }

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req.user.userId;
    return await this.paymentService.getPaymentStatus(orderId, userId);
  }

  @Put('admin/:orderId/status')
  @Public()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async adminUpdatePaymentStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdatePaymentStatusDto,
    @Req() req: any,
  ) {
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;
    return await this.paymentService.adminUpdatePaymentStatus(
      orderId,
      dto.paymentStatus,
      adminId,
      adminEmail,
    );
  }

  @Post('admin/:orderId/sync-cashfree')
  @Public()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async adminSyncCashfreeStatus(
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;
    return await this.paymentService.adminSyncCashfreeStatus(
      orderId,
      adminId,
      adminEmail,
    );
  }
}
