import { Body, Controller, ForbiddenException, Get, Header, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlankitKycService } from './alankit-kyc.service';
import { FetchPanKycDto } from './dto/fetch-pan-kyc.dto';

@Controller('kyc/alankit')
@UseGuards(JwtAuthGuard)
export class AlankitKycController {
  constructor(private readonly service: AlankitKycService) {}

  private customer(req: any): string {
    if (req.user?.type !== 'USER' || !req.user.userId) throw new ForbiddenException('A customer session is required.');
    return req.user.userId;
  }

  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() req: any) { return this.service.status(this.customer(req)); }

  @Post('fetch')
  @Header('Cache-Control', 'private, no-store')
  fetch(@Req() req: any, @Body() dto: FetchPanKycDto) { return this.service.lookup(this.customer(req), dto.pan); }

  @Post('refresh')
  @Header('Cache-Control', 'private, no-store')
  refresh(@Req() req: any) { return this.service.refresh(this.customer(req)); }
}
