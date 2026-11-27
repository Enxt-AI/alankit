import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PinoNestLogger } from '@/logger';
import { SettingsService } from './settings.service';
import { AdminOrOperationJwtAuthGuard } from '../auth/guards/admin-or-operation-jwt-auth.guard';

import { Public } from '../auth/decorators/public.decorator';
import { CreateESignTemplateDto } from './dto/create-esign-template.dto';

@Controller('admin/settings')
@Public()
@UseGuards(AdminOrOperationJwtAuthGuard)
export class SettingsController {
  private readonly logger = new PinoNestLogger('stocks-service', 'SettingsController');
  constructor(private readonly settingsService: SettingsService) {}

  @Get('esign-templates')
  async getAllESignTemplates() {
    return this.settingsService.getAllESignTemplates();
 }

  @Post('esign-templates')
  async createESignTemplate(@Body() body: CreateESignTemplateDto, @Req() req: any) {
    const adminId = req.user.adminId;
    return this.settingsService.createESignTemplate(body, adminId);
 }

  @Put('esign-templates/:id')
  async updateESignTemplate(@Param('id') id: string, @Body() body: CreateESignTemplateDto) {
    return this.settingsService.updateESignTemplate(id, body.templateId, body.pdfUrl);
 }

  @Delete('esign-templates/:id')
  async deleteESignTemplate(@Param('id') id: string) {
    return this.settingsService.deleteESignTemplate(id);
 }

  /**
   * POST /api/admin/settings/upload-esign-html
   * Upload the eSign template HTML document (stored locally in uploads/esign-documents/)
   */
  @Post('upload-esign-html')
  async uploadESignHtml(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
     }

      if (data.mimetype !== 'text/html') {
        throw new BadRequestException('Only HTML files are allowed');
     }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
     }

      return await this.settingsService.uploadESignHtml(data.filename, buffer);
   } catch (error) {
      this.logger.error('UPLOAD ERROR:', error);
      if (error instanceof BadRequestException) {
        throw error;
     }
      throw new BadRequestException('Failed to upload HTML');
   }
 }

  @Get('revenue-sharing')
  async getRevenueSharingSettings() {
    return this.settingsService.getRevenueSharingSettings();
 }

  @Post('revenue-sharing')
  async updateRevenueSharingSettings(@Body() body: { type: string; revenuePercentage: number; incentivePercentage?: number }, @Req() req: any) {
    if (req.user.role !== 'SUPER_ADMIN') {
      // Create Maker-Checker Proposal for Operations (or other non-Super Admin roles)
      return this.settingsService.proposeRevenueSharingUpdate(body, req.user.adminId);
   }
    return this.settingsService.updateRevenueSharingSettings(body);
 }
}
