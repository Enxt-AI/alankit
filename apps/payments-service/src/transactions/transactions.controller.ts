import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(
    @Req() req: any,
  ): Promise<Awaited<ReturnType<TransactionsService['findAll']>>> {
    const user = req.user as any;
    return this.transactionsService.findAll(user.userId);
  }
}
