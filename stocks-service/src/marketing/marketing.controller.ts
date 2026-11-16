import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Req,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { MarketingService, MarketingAdminStats } from './marketing.service';
import { WebhookService } from './webhook.service';
import { MarketingJwtAuthGuard } from '../auth/guards/marketing-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
// NOTE: AssignLeadDto was removed as part of RM system deprecation.
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { FacebookWebhookDto } from './dto/webhook-facebook.dto';
import { GoogleWebhookDto } from './dto/webhook-google.dto';
import { TwitterWebhookDto } from './dto/webhook-twitter.dto';
import * as crypto from 'crypto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Marketing Controller
 * Handles REST endpoints for marketing campaigns and leads management
 * Base route: /marketing
 */
@Controller('marketing')
export class MarketingController {
  private readonly logger = new PinoNestLogger('stocks-service', 'MarketingController');

  constructor(
    private marketingService: MarketingService,
    private webhookService: WebhookService,
  ) {}

  // ===============================
  // CAMPAIGN ENDPOINTS
  // ===============================

  /**
   * GET /marketing/campaigns
   * Get all marketing campaigns
   */
  @Get('campaigns')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getAllCampaigns() {
    const campaigns = await this.marketingService.getAllCampaigns();
    return { success: true, campaigns };
 }

  /**
   * GET /marketing/campaigns/:id
   * Get campaign by ID
   */
  @Get('campaigns/:id')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getCampaignById(@Param('id') id: string) {
    const campaign = await this.marketingService.getCampaignById(id);
    return { success: true, campaign };
 }

  /**
   * POST /marketing/campaigns
   * Create new campaign
   */
  @Post('campaigns')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async createCampaign(@Body() dto: CreateCampaignDto) {
    const campaign = await this.marketingService.createCampaign(dto);
    return { success: true, campaign };
 }

  /**
   * PATCH /marketing/campaigns/:id
   * Update campaign
   */
  @Patch('campaigns/:id')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCampaignDto>,
  ) {
    const campaign = await this.marketingService.updateCampaign(id, dto);
    return { success: true, campaign };
 }

  /**
   * DELETE /marketing/campaigns/:id
   * Delete campaign
   */
  @Delete('campaigns/:id')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async deleteCampaign(@Param('id') id: string) {
    await this.marketingService.deleteCampaign(id);
    return { success: true, message: 'Campaign deleted' };
 }

  // ===============================
  // LEAD ENDPOINTS
  // ===============================

  /**
   * GET /marketing/leads-analytics
   * Get all leads enriched with user/transaction analytics
   */
  @Get('leads-analytics')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getLeadsAnalytics(@Query() filters: LeadFilterDto, @Req() req: any) {
    const result = await this.marketingService.getLeadsAnalytics(filters, req.user);
    return { success: true, ...result };
 }

  /**
   * GET /marketing/top-stocks
   * Get top stocks based on metrics
   */
  @Get('top-stocks')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getTopStocks(@Query('sortBy') sortBy: 'transactionCount' | 'transactionValue' | 'userRequested' | 'userWatchlisted') {
    const result = await this.marketingService.getTopStocks(sortBy);
    return { success: true, ...result };
 }

  /**
   * GET /marketing/dropped-checkouts
   * Get users who initiated checkout but dropped during payment
   */
  @Get('dropped-checkouts')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getDroppedCheckouts(@Query() query: any) {
    const result = await this.marketingService.getDroppedCheckouts(query);
    return { success: true, ...result };
 }

  /**
   * GET /marketing/esign-dropouts
   * Get users who initiated e-sign but never signed (first-class attempt log,
   * includes sign-first abandons with no Order row)
   */
  @Get('esign-dropouts')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getEsignDropouts(@Query() query: any) {
    const result = await this.marketingService.getEsignDropouts(query);
    return { success: true, ...result };
 }

  /**
   * POST /marketing/sync-users
   * Syncs existing User records to MarketingLead table
   */
  @Post('sync-users')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async syncDatabaseUsers(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'SUPER_ADMIN' && role !== 'MARKETING_MANAGER') {
      throw new UnauthorizedException('Insufficient permissions to sync users');
   }
    const result = await this.marketingService.syncDatabaseUsersToLeads();
    return result;
 }

  /**
   * GET /marketing/leads
   * Get all leads with filtering and pagination
   */
  @Get('leads')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getAllLeads(@Query() filters: LeadFilterDto, @Req() req: any) {
    const result = await this.marketingService.getAllLeads(filters, req.user);
    return { success: true, ...result };
 }

  /**
   * GET /marketing/leads/:id/detail
   * Full detail for the lead popup (must be declared before leads/:id)
   */
  @Get('leads/:id/detail')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getLeadDetail(@Param('id') id: string) {
    const detail = await this.marketingService.getLeadDetail(id);
    return { success: true, detail };
 }

  /**
   * GET /marketing/leads/:id
   * Get lead by ID
   */
  @Get('leads/:id')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getLeadById(@Param('id') id: string) {
    const lead = await this.marketingService.getLeadById(id);
    return { success: true, lead };
 }

  /**
   * POST /marketing/leads
   * Create new lead
   */
  @Post('leads')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async createLead(@Body() dto: CreateLeadDto) {
    const lead = await this.marketingService.createLead(dto);
    return { success: true, lead };
 }

  /**
   * PATCH /marketing/leads/:id
   * Update lead
   */
  @Patch('leads/:id')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    const lead = await this.marketingService.updateLead(id, dto);
    return { success: true, lead };
 }

  /**
   * GET /marketing/panel-users
   * Get list of marketing panel users (for lead assignment)
   */
  @Get('panel-users')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async getMarketingPanelUsers() {
    const users = await this.marketingService.getMarketingPanelUsers();
    return { success: true, users };
 }

  /**
   * PATCH /marketing/leads/:id/assign
   * Assign a lead to a marketing user (Sales Employee or Marketing Manager)
   */
  @Patch('leads/:id/assign')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async assignLeadToUser(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
   }
    await this.marketingService.assignLeadToUser(id, userId);
    return { success: true, message: 'Lead assigned successfully' };
 }

  /**
   * PATCH /marketing/leads/bulk-assign
   * Assign multiple leads to a marketing user
   */
  @Patch('leads/bulk-assign')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async bulkAssignLeads(
    @Body('leadIds') leadIds: string[],
    @Body('userId') userId: string,
  ) {
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw new BadRequestException('leadIds array is required');
   }
    if (!userId) {
      throw new BadRequestException('userId is required');
   }
    await this.marketingService.bulkAssignLeads(leadIds, userId);
    return { success: true, message: 'Leads bulk assigned successfully' };
 }

  /**
   * PATCH /marketing/leads/:id/status
   * Update lead status
   */
  @Patch('leads/:id/status')
  @Public()
  @UseGuards(MarketingJwtAuthGuard)
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    await this.marketingService.updateLeadStatus(id, dto.status);
    return { success: true, message: 'Lead status updated' };
 }

  /**
   * GET /marketing/admin/stats - Get marketing analytics for admin dashboard (Admin only)
   */
  @Get('admin/stats')
  @Public()
  @UseGuards(AdminJwtAuthGuard)
  async getMarketingStatsForAdmin(): Promise<MarketingAdminStats> {
    const stats = await this.marketingService.getMarketingStatsForAdmin();
    return stats;
 }

  // ===============================
  // WEBHOOK ENDPOINTS (PUBLIC)
  // ===============================

  /**
   * GET /marketing/webhooks/facebook - Facebook Webhook Verification
   * Handles Facebook's initial webhook setup verification
   */
  @Get('webhooks/facebook')
  @Public()
  async verifyFacebookWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // Verify the verify token matches our configured token
    const expectedToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('🔐 Facebook webhook verification successful');
      return challenge; // Return challenge as plain text
   } else {
      this.logger.log('❌ Facebook webhook verification failed');
      throw new UnauthorizedException('Verification failed');
   }
 }

  /**
   * POST /marketing/webhooks/facebook - Facebook Lead Ads Webhook
   * Receives lead data from Facebook Lead Ads
   */
  @Post('webhooks/facebook')
  @Public()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow additional properties from Facebook
      transform: true,
   }),
  )
  async handleFacebookWebhook(
    @Body() webhookData: FacebookWebhookDto,
    @Headers('x-hub-signature-256') signature: string,
    @Req() request: any,
  ) {
    try {
      // Check for required signature header
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature header');
     }

      // Require raw body for signature verification
      if (!request.rawBody) {
        this.logger.error(
          '❌ Raw body not available for Facebook webhook signature verification',
        );
        throw new InternalServerErrorException('Raw body not available');
     }

      // Verify signature
      if (
        !this.webhookService.verifyFacebookSignature(request.rawBody, signature)
      ) {
        throw new UnauthorizedException('Invalid webhook signature');
     }

      // Validate DTO
      if (!webhookData.entry || webhookData.entry.length === 0) {
        throw new BadRequestException('Invalid webhook payload');
     }

      // Extract platform campaign ID from webhook data
      const platformCampaignId = webhookData.entry[0].leadgen_id;

      // Find internal campaign ID
      const campaignId = await this.webhookService.findCampaignByPlatformId(
        platformCampaignId,
        'FACEBOOK',
      );
      if (!campaignId) {
        this.logger.log(
          '⚠️ Campaign not found for Facebook leadgen_id:',
          platformCampaignId,
        );
        return { success: false, message: 'Campaign not found' };
     }

      // Normalize and create lead
      const leadData = this.webhookService.normalizeFacebookLead(
        webhookData,
        campaignId,
      );
      const lead = await this.webhookService.createOrUpdateLead(leadData);

      return { success: true, leadId: lead.id };
   } catch (error) {
      this.logger.error('❌ Facebook webhook error:', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
     }
      throw new InternalServerErrorException('Webhook processing failed');
   }
 }

  /**
   * POST /marketing/webhooks/google - Google Ads Lead Form Webhook
   * Receives lead data from Google Ads Lead Form Extensions
   */
  @Post('webhooks/google')
  @Public()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow additional properties from Google
      transform: true,
   }),
  )
  async handleGoogleWebhook(
    @Body() webhookData: GoogleWebhookDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Extract JWT token from Authorization header
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new UnauthorizedException('Missing authorization token');
     }

      // Verify JWT token
      if (!this.webhookService.verifyGoogleSignature(token)) {
        throw new UnauthorizedException('Invalid webhook token');
     }

      // Extract platform campaign ID
      const platformCampaignId = webhookData.campaignId;

      // Find internal campaign ID
      const campaignId = await this.webhookService.findCampaignByPlatformId(
        platformCampaignId,
        'GOOGLE',
      );
      if (!campaignId) {
        this.logger.log(
          '⚠️ Campaign not found for Google campaign ID:',
          platformCampaignId,
        );
        return { success: false, message: 'Campaign not found' };
     }

      // Normalize and create lead
      const leadData = this.webhookService.normalizeGoogleLead(
        webhookData,
        campaignId,
      );
      const lead = await this.webhookService.createOrUpdateLead(leadData);

      return { success: true, leadId: lead.id };
   } catch (error) {
      this.logger.error('❌ Google webhook error:', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
     }
      throw new InternalServerErrorException('Webhook processing failed');
   }
 }

  /**
   * GET /marketing/webhooks/twitter - Twitter CRC Validation
   * Handles Twitter's Challenge-Response Check for webhook verification
   */
  @Get('webhooks/twitter')
  @Public()
  async verifyTwitterWebhook(@Query('crc_token') crcToken: string) {
    if (!crcToken) {
      throw new BadRequestException('Missing crc_token');
   }

    // Compute HMAC-SHA256 of crc_token
    const secret = process.env.TWITTER_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Twitter webhook secret not configured');
   }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(crcToken);
    const responseToken = hmac.digest('base64');

    this.logger.log('🔐 Twitter CRC validation successful');
    return { response_token: `sha256=${responseToken}` };
 }

  /**
   * POST /marketing/webhooks/twitter - Twitter Lead Generation Cards Webhook
   * Receives lead data from Twitter Lead Generation Cards
   */
  @Post('webhooks/twitter')
  @Public()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow additional properties from Twitter
      transform: true,
   }),
  )
  async handleTwitterWebhook(
    @Body() webhookData: TwitterWebhookDto,
    @Headers('x-twitter-webhooks-signature') signature: string,
    @Req() request: any,
  ) {
    try {
      // Check for required signature header
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature header');
     }

      // Require raw body for signature verification
      if (!request.rawBody) {
        this.logger.error(
          '❌ Raw body not available for Twitter webhook signature verification',
        );
        throw new InternalServerErrorException('Raw body not available');
     }

      // Verify signature
      if (
        !this.webhookService.verifyTwitterSignature(request.rawBody, signature)
      ) {
        throw new UnauthorizedException('Invalid webhook signature');
     }

      // Extract platform campaign ID (using card_id as identifier)
      const platformCampaignId = webhookData.lead_generation_card_data.card_id;

      // Find internal campaign ID
      const campaignId = await this.webhookService.findCampaignByPlatformId(
        platformCampaignId,
        'TWITTER',
      );
      if (!campaignId) {
        this.logger.log(
          '⚠️ Campaign not found for Twitter card ID:',
          platformCampaignId,
        );
        return { success: false, message: 'Campaign not found' };
     }

      // Normalize and create lead
      const leadData = this.webhookService.normalizeTwitterLead(
        webhookData,
        campaignId,
      );
      const lead = await this.webhookService.createOrUpdateLead(leadData);

      return { success: true, leadId: lead.id };
   } catch (error) {
      this.logger.error('❌ Twitter webhook error:', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
     }
      throw new InternalServerErrorException('Webhook processing failed');
   }
 }

  // NOTE: getAllRMs endpoint was removed as part of RM system deprecation.
}
