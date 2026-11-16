import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { FacebookWebhookDto } from './dto/webhook-facebook.dto';
import { GoogleWebhookDto } from './dto/webhook-google.dto';
import { TwitterWebhookDto } from './dto/webhook-twitter.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PinoNestLogger } from '@smc/logger';

/**
 * Webhook Service
 * Handles webhook verification, payload normalization, and lead creation
 * for marketing platform integrations (Facebook, Google Ads, Twitter)
 */
@Injectable()
export class WebhookService {
  private readonly logger = new PinoNestLogger('stocks-service', 'WebhookService');

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // ===============================
  // SIGNATURE VERIFICATION METHODS
  // ===============================

  /**
   * Verify Facebook webhook signature using SHA256 HMAC
   * @param payload Raw request body as string
   * @param signature x-hub-signature-256 header value (format: sha256=<hash>)
   * @returns true if signature is valid, false otherwise
   */
  verifyFacebookSignature(payload: string, signature: string): boolean {
    try {
      const secret = this.configService.get<string>('FACEBOOK_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.error('❌ Facebook webhook secret not configured');
        return false;
      }

      // Check for null/missing signature header
      if (!signature || !signature.startsWith('sha256=')) {
        this.logger.warn(
          '❌ Facebook webhook signature header missing or malformed',
        );
        return false;
      }

      // Extract hash from signature header (format: sha256=<hash>)
      const expectedSignature = signature.replace('sha256=', '');
      if (!expectedSignature) {
        this.logger.warn('❌ Facebook webhook signature hash is empty');
        return false;
      }

      // Compute HMAC-SHA256
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const computedHash = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(computedHash, 'hex'),
      );

      if (isValid) {
        this.logger.log('🔐 Facebook webhook signature verified successfully');
      } else {
        this.logger.warn('❌ Facebook webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ Error verifying Facebook signature:', error);
      return false;
    }
  }

  /**
   * Verify Google Ads webhook signature using JWT
   * @param token JWT token from Authorization header
   * @returns true if token is valid, false otherwise
   */
  verifyGoogleSignature(token: string): boolean {
    try {
      const secret = this.configService.get<string>(
        'GOOGLE_ADS_WEBHOOK_SECRET',
      );
      if (!secret) {
        this.logger.error('❌ Google Ads webhook secret not configured');
        return false;
      }

      // Use proper JWT verification
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.logger.warn('❌ Invalid JWT format');
        return false;
      }

      // Decode header and payload
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Verify signature using HMAC-SHA256 (Google typically uses HS256)
      const signature = parts[2];
      const data = `${parts[0]}.${parts[1]}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64url'); // Google uses base64url encoding

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature),
        )
      ) {
        this.logger.warn('❌ Google Ads JWT signature verification failed');
        return false;
      }

      // Validate expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        this.logger.warn('❌ JWT token expired');
        return false;
      }

      // Basic issuer validation (Google typically uses specific issuers)
      if (payload.iss && !payload.iss.includes('google')) {
        this.logger.warn('❌ Invalid JWT issuer');
        return false;
      }

      this.logger.log('🔐 Google Ads webhook token verified successfully');
      return true;
    } catch (error) {
      this.logger.error('❌ Error verifying Google signature:', error);
      return false;
    }
  }

  /**
   * Verify Twitter webhook signature using HMAC-SHA256
   * @param payload Raw request body as string
   * @param signature x-twitter-webhooks-signature header value
   * @returns true if signature is valid, false otherwise
   */
  verifyTwitterSignature(payload: string, signature: string): boolean {
    try {
      const secret = this.configService.get<string>('TWITTER_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.error('❌ Twitter webhook secret not configured');
        return false;
      }

      // Check for null/missing signature header
      if (!signature || !signature.startsWith('sha256=')) {
        this.logger.warn(
          '❌ Twitter webhook signature header missing or malformed',
        );
        return false;
      }

      // Extract base64 signature from header (format: sha256=<base64>)
      const expectedSignatureBase64 = signature.replace('sha256=', '');
      if (!expectedSignatureBase64) {
        this.logger.warn('❌ Twitter webhook signature is empty');
        return false;
      }

      // Compute HMAC-SHA256
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const computedHash = hmac.digest();

      // Decode expected signature from base64
      const expectedSignature = Buffer.from(expectedSignatureBase64, 'base64');

      // Use timing-safe comparison
      const isValid = crypto.timingSafeEqual(expectedSignature, computedHash);

      if (isValid) {
        this.logger.log('🔐 Twitter webhook signature verified successfully');
      } else {
        this.logger.warn('❌ Twitter webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('❌ Error verifying Twitter signature:', error);
      return false;
    }
  }

  // ===============================
  // LEAD NORMALIZATION METHODS
  // ===============================

  /**
   * Normalize Facebook webhook data to CreateLeadDto format
   * @param webhookData Facebook webhook payload
   * @param campaignId Internal campaign ID to assign the lead to
   * @returns Normalized lead data ready for creation
   */
  normalizeFacebookLead(
    webhookData: FacebookWebhookDto,
    campaignId: string,
  ): Partial<CreateLeadDto> {
    const entry = webhookData.entry[0];
    const lead = entry.lead;

    // Extract field data into a map for easy access
    const fieldMap = new Map<string, string>();
    lead.field_data.forEach((field) => {
      if (field.values && field.values.length > 0) {
        fieldMap.set(field.name, field.values[0]);
      }
    });

    const normalizedLead: Partial<CreateLeadDto> = {
      fullName: fieldMap.get('full_name') || '',
      email: fieldMap.get('email') || '',
      phone: fieldMap.get('phone_number') || '',
      source: 'FACEBOOK',
      platformLeadId: lead.id,
      campaignId,
      metadata: {
        platform: 'FACEBOOK',
        leadgenId: entry.leadgen_id,
        pageId: entry.page_id,
        createdTime: lead.created_time,
        originalFieldData: lead.field_data,
      },
    };

    this.logger.log(
      `📝 Normalized Facebook lead: ${lead.id} -> ${normalizedLead.fullName}`,
    );
    return normalizedLead;
  }

  /**
   * Normalize Google Ads webhook data to CreateLeadDto format
   * @param webhookData Google webhook payload
   * @param campaignId Internal campaign ID to assign the lead to
   * @returns Normalized lead data ready for creation
   */
  normalizeGoogleLead(
    webhookData: GoogleWebhookDto,
    campaignId: string,
  ): Partial<CreateLeadDto> {
    // Extract field data into a map for easy access
    const fieldMap = new Map<string, string>();
    webhookData.userColumnData.forEach((field) => {
      if (field.stringValue) {
        fieldMap.set(field.columnId, field.stringValue);
      }
    });

    const normalizedLead: Partial<CreateLeadDto> = {
      fullName: fieldMap.get('FULL_NAME') || '',
      email: fieldMap.get('EMAIL') || '',
      phone: fieldMap.get('PHONE_NUMBER') || '',
      source: 'GOOGLE',
      platformLeadId:
        webhookData.gclid || `google_${webhookData.leadFormId}_${Date.now()}`,
      campaignId,
      metadata: {
        platform: 'GOOGLE',
        leadFormId: webhookData.leadFormId,
        campaignId: webhookData.campaignId,
        adGroupId: webhookData.adGroupId,
        gclid: webhookData.gclid,
        originalUserColumnData: webhookData.userColumnData,
      },
    };

    this.logger.log(
      `📝 Normalized Google lead: ${normalizedLead.platformLeadId} -> ${normalizedLead.fullName}`,
    );
    return normalizedLead;
  }

  /**
   * Normalize Twitter webhook data to CreateLeadDto format
   * @param webhookData Twitter webhook payload
   * @param campaignId Internal campaign ID to assign the lead to
   * @returns Normalized lead data ready for creation
   */
  normalizeTwitterLead(
    webhookData: TwitterWebhookDto,
    campaignId: string,
  ): Partial<CreateLeadDto> {
    const cardData = webhookData.lead_generation_card_data;
    const userData = cardData.user_data;

    const normalizedLead: Partial<CreateLeadDto> = {
      fullName: userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      source: 'TWITTER',
      platformLeadId: cardData.card_id,
      campaignId,
      metadata: {
        platform: 'TWITTER',
        cardId: cardData.card_id,
        cardName: cardData.card_name,
        forUserId: webhookData.for_user_id,
        originalUserData: userData,
      },
    };

    this.logger.log(
      `📝 Normalized Twitter lead: ${cardData.card_id} -> ${normalizedLead.fullName}`,
    );
    return normalizedLead;
  }

  // ===============================
  // LEAD CREATION & DEDUPLICATION
  // ===============================

  /**
   * Create or update a lead with deduplication based on platformLeadId
   * @param leadData Normalized lead data
   * @returns Created or updated MarketingLead
   */
  async createOrUpdateLead(leadData: Partial<CreateLeadDto>) {
    try {
      if (!leadData.platformLeadId || !leadData.source) {
        // Fallback: create new lead if no platform ID or source
        const lead = await this.prisma.marketingLead.create({
          data: leadData as CreateLeadDto,
        });
        this.logger.log(`🆕 Created new lead without platform ID: ${lead.id}`);
        return lead;
      }

      // Use atomic upsert for deduplication
      const lead = await this.prisma.marketingLead.upsert({
        where: {
          platformLeadId_source: {
            platformLeadId: leadData.platformLeadId,
            source: leadData.source,
          },
        },
        update: {
          ...leadData,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        },
        create: { ...leadData, lastActivityAt: new Date() } as CreateLeadDto,
      });

      // Log based on whether this was an update or create
      if (lead.createdAt.getTime() === lead.updatedAt.getTime()) {
        this.logger.log(
          `🆕 Created new lead: ${lead.id} (${leadData.platformLeadId})`,
        );
      } else {
        this.logger.log(
          `🔄 Updated existing lead: ${lead.id} (${leadData.platformLeadId})`,
        );
      }

      return lead;
    } catch (error) {
      this.logger.error('❌ Error creating/updating lead:', error);
      throw error;
    }
  }

  // ===============================
  // CAMPAIGN MAPPING
  // ===============================

  /**
   * Find internal campaign ID by platform campaign ID
   * @param platformCampaignId External platform campaign ID
   * @param platform Platform name (FACEBOOK, GOOGLE, TWITTER)
   * @returns Internal campaign ID or null if not found
   */
  async findCampaignByPlatformId(
    platformCampaignId: string,
    platform: string,
  ): Promise<string | null> {
    try {
      const campaign = await this.prisma.marketingCampaign.findFirst({
        where: {
          platformCampaignId,
          platform: platform.toUpperCase(),
        },
      });

      if (campaign) {
        this.logger.log(
          `🎯 Found campaign mapping: ${platformCampaignId} -> ${campaign.id}`,
        );
        return campaign.id;
      } else {
        this.logger.warn(
          `⚠️ Campaign not found for platform ID: ${platformCampaignId} (${platform})`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error('❌ Error finding campaign by platform ID:', error);
      throw error;
    }
  }
}
