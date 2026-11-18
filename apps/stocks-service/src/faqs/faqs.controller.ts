import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  @Public()
  async getAllActiveFaqs(
    @Query('stockId') stockId?: string,
    @Query('category') category?: string,
  ) {
    return this.faqsService.getAllActiveFaqs({ stockId, category });
  }

  @Get(':id')
  @Public()
  async getFaqById(@Param('id') id: string) {
    return this.faqsService.getFaqById(id);
  }

  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_faqs')
  @Get('/admin/all')
  async getAllFaqsAdmin(@Query('stockId') stockId?: string) {
    return this.faqsService.getAllFaqsAdmin({ stockId });
  }

  /**
   * GET /api/faqs/cms/all
   * Get all FAQs including inactive (CMS panel access with cms_panel_token)
   * Requires 'cms_faqs' permission
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_faqs')
  async getAllFaqsCms(@Query('stockId') stockId?: string) {
    return this.faqsService.getAllFaqsAdmin({ stockId });
  }

  /**
   * POST /api/faqs/cms
   * Create FAQ (CMS panel access with cms_panel_token). Requires 'cms_faqs' permission.
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_faqs')
  async createFaqCms(@Body() dto: CreateFaqDto, @Req() req: any) {
    const changeRequest = await this.faqsService.proposeCreate(dto, req.user.adminId);
    return { message: 'FAQ creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/faqs/cms/:id
   * CMS: propose update — held for admin approval.
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_faqs')
  async updateFaqCms(@Param('id') id: string, @Body() dto: UpdateFaqDto, @Req() req: any) {
    const changeRequest = await this.faqsService.proposeUpdate(id, dto, req.user.adminId);
    return { message: 'FAQ update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/faqs/cms/:id
   * CMS: propose delete — stays live until admin approves.
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_faqs')
  async deleteFaqCms(@Param('id') id: string, @Req() req: any) {
    const changeRequest = await this.faqsService.proposeDelete(id, req.user.adminId);
    return { message: 'FAQ deletion submitted for admin approval', changeRequest };
  }

  /**
   * GET /api/faqs/cms/:id/versions
   * Get version history for FAQ (CMS panel access with cms_panel_token)
   * No permissions guard needed for read-only version history
   */
  @Get('cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getFaqVersionHistoryCms(@Param('id') id: string) {
    return this.faqsService.getFaqVersionHistory(id);
  }

  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Post('/admin')
  async createFaq(@Body() dto: CreateFaqDto) {
    return this.faqsService.createFaq(dto);
  }

  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Put('/admin/:id')
  async updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqsService.updateFaq(id, dto);
  }

  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Delete('/admin/:id')
  async deleteFaq(@Param('id') id: string) {
    return this.faqsService.deleteFaq(id);
  }

  /**
   * GET /api/faqs/admin/:id/versions
   * Get version history for FAQ (admin only)
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Get('/admin/:id/versions')
  async getFaqVersionHistory(@Param('id') id: string) {
    return this.faqsService.getFaqVersionHistory(id);
  }

  /**
   * POST /api/faqs/admin/:id/rollback/:versionNumber
   * Rollback FAQ to a specific version (admin only)
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Post('/admin/:id/rollback/:versionNumber')
  async rollbackFaq(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.faqsService.rollbackFaq(id, parseInt(versionNumber));
  }
}
