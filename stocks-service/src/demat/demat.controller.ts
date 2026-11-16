import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  BadRequestException,
  Req,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DematService } from './demat.service';
import { LinkDematDto } from './dto/link-demat.dto';

@Controller('demat')
export class DematController {
  constructor(private readonly dematService: DematService) {}

  @Post('link')
  @UseGuards(JwtAuthGuard)
  async linkDemat(@Request() req, @Body() dto: LinkDematDto) {
    const userId = req.user.userId;
    return await this.dematService.linkDemat(userId, dto);
  }


  @Post('upload-document/:documentType')
  @UseGuards(JwtAuthGuard)
  async uploadDocument(
    @Req() req: any,
    @Param('documentType') documentType: string,
    @Body() body: { fileUrl: string; fileName: string; fileSize: number }
  ) {
    const userId = req.user.userId;

    try {
      if (!body || !body.fileUrl) {
        throw new BadRequestException('File URL is required');
      }

      return await this.dematService.uploadDematDocument(
        userId,
        documentType,
        body,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload document');
    }
  }

  @Put('admin/:userId/approve')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async adminApproveDemat(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    const adminId = req.user?.adminId;
    const adminEmail = req.user?.email;
    return await this.dematService.adminApproveDemat(userId, adminId, adminEmail);
  }

  @Put('admin/:userId/reject')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async adminRejectDemat(
    @Param('userId') userId: string,
    @Body('reason') reason: string,
    @Req() req: any
  ) {
    const adminId = req.user?.adminId;
    const adminEmail = req.user?.email;
    return await this.dematService.adminRejectDemat(userId, reason, adminId, adminEmail);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getDematStatus(@Request() req) {
    const userId = req.user.userId;
    return await this.dematService.getDematStatus(userId);
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard)
  async resetDemat(@Request() req) {
    const userId = req.user.userId;
    return await this.dematService.resetDemat(userId);
  }
}
