import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SellRequestsService } from './sell-requests.service';
import { CreateSellRequestDto } from './dto/create-sell-request.dto';
import { UpdateSellRequestStatusDto } from './dto/update-sell-request-status.dto';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { AdminOrOperationJwtAuthGuard } from '../auth/guards/admin-or-operation-jwt-auth.guard';
import { SellRequestStatus } from 'db-unlisted-stox';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Sell Requests Controller
 *
 * User-facing routes: POST /sell-requests, GET /sell-requests/my
 * Admin/Operations routes: GET /admin/sell-requests, PATCH /admin/sell-requests/:id/status
 */
@Controller()
export class SellRequestsController {
  constructor(private readonly sellRequestsService: SellRequestsService) {}

  // ============================================
  // USER-FACING ENDPOINTS
  // ============================================

  /**
   * Create a new sell request (user submits from stock detail page).
   */
  @Post('sell-requests')
  @UseGuards(UserJwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateSellRequestDto) {
    const userId = req.user.userId;
    return this.sellRequestsService.create(userId, dto);
  }

  /**
   * Get current user's sell requests (for "My Sell Requests" dashboard).
   */
  @Get('sell-requests/my')
  @UseGuards(UserJwtAuthGuard)
  async getMySellRequests(@Req() req: any) {
    const userId = req.user.userId;
    return this.sellRequestsService.getUserSellRequests(userId);
  }

  // ============================================
  // ADMIN / OPERATIONS ENDPOINTS
  // ============================================

  /**
   * Get all sell requests, optionally filtered by status.
   */
  @Get('admin/sell-requests')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async getAll(@Query('status') status?: string) {
    const parsedStatus = status ? (status as SellRequestStatus) : undefined;
    return this.sellRequestsService.getAllSellRequests(parsedStatus);
  }

  /**
   * Update a sell request's status with optional admin note.
   */
  @Patch('admin/sell-requests/:id/status')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSellRequestStatusDto,
  ) {
    return this.sellRequestsService.updateStatus(id, dto);
  }
}
