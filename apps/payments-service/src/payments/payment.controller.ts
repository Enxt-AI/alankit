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
  UnauthorizedException,
  Res,
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
import { NdpsGateway } from './ndps.gateway';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('payments')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    @InjectQueue('payment-webhooks') private readonly paymentQueue: Queue,
    private readonly config: ConfigService,
    private readonly ndps: NdpsGateway,
  ) {}

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'ok',
    };
  }

  private assertInternalService(headers: Record<string, string>) {
    const expected = this.config.get<string>('PAYMENT_SERVICE_INTERNAL_TOKEN', '');
    const supplied = headers['x-payment-service-token'] || '';
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    if (!expected || expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      throw new UnauthorizedException('Invalid service credentials');
    }
  }

  @Post('internal/ndps/reconcile')
  @Public()
  async internalReconcile(@Body() body: { date?: string; executedBy?: string }, @Headers() headers: Record<string, string>) {
    this.assertInternalService(headers);
    return this.paymentService.runNdpsReconciliation(body?.date, body?.executedBy || 'ACCOUNTANT');
  }

  @Post('admin/:orderId/refund')
  @Public()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async refundOrder(@Param('orderId') orderId: string, @Req() req: any) {
    return this.paymentService.refundOrder(orderId, req.admin.id);
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

  @Post('ndps/callback')
  @HttpCode(200)
  @Public()
  async handleWebhook(@Body() body: any) {
    this.ndps.decodeResponse(body);
    const jobId = crypto.createHash('sha256').update(body.encData).digest('hex');
    await this.paymentQueue.add('ndps-event', { body }, { jobId });
    return { status: 'Received' };
  }

  @Post('ndps/return')
  @Public()
  async handleReturn(@Body() body: any, @Res() reply: any) {
    const { orderId } = await this.paymentService.processWebhookPayload({ body });
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
    return reply.code(303).header('Location', `${frontend}/payment/result?orderId=${encodeURIComponent(orderId)}`).send();
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

  @Post('admin/:orderId/sync-ndps')
  @Public()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async adminSyncNdpsStatus(
    @Param('orderId') orderId: string,
    @Req() req: any,
  ): Promise<Awaited<ReturnType<PaymentService['adminSyncNdpsStatus']>>> {
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;
    return await this.paymentService.adminSyncNdpsStatus(
      orderId,
      adminId,
      adminEmail,
    );
  }
}
