import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Req,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BankService } from './bank.service';
import { LinkBankDto } from './dto/link-bank.dto';

@Controller('bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Post('link')
  @UseGuards(JwtAuthGuard)
  async linkBank(@Request() req, @Body() dto: LinkBankDto) {
    const userId = req.user.userId;
    return await this.bankService.linkBank(userId, dto);
  }

  @Put('admin/:userId/approve')
  @UseGuards(JwtAuthGuard)
  async adminApproveBank(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    const adminId = req.user?.userId;
    const adminEmail = req.user?.email;
    return await this.bankService.adminApproveBank(userId, adminId, adminEmail);
  }

  @Put('admin/:userId/reject')
  @UseGuards(JwtAuthGuard)
  async adminRejectBank(
    @Param('userId') userId: string,
    @Body('reason') reason: string,
    @Req() req: any
  ) {
    const adminId = req.user?.userId;
    const adminEmail = req.user?.email;
    return await this.bankService.adminRejectBank(userId, reason, adminId, adminEmail);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getBankStatus(@Request() req) {
    const userId = req.user.userId;
    return await this.bankService.getBankStatus(userId);
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard)
  async resetBank(@Request() req) {
    const userId = req.user.userId;
    return await this.bankService.resetBank(userId);
  }
}
