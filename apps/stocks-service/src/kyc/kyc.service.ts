import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'email-service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-types';
import { SubmitBankDetailsDto } from './dto/submit-bank-details.dto';
import { Prisma } from 'db-unlistedstock';
import { AccountingService } from '../accounting/accounting.service';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { hasCurrentDigilockerVerification, validateDigilockerIdentity } from './digilocker-validation';
import { PinoNestLogger } from '@/logger';

/**
 * File upload data structure
 */
export interface FileData {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * KYC Service
 * Handles KYC verification flow, integrations, bank details and document uploads
 */
@Injectable()
export class KycService {
  private readonly logger = new PinoNestLogger('stocks-service', 'KycService');
  private readonly uploadsDir: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private accountingService: AccountingService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'kyc');

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    this.logger.log('KYC Service initialized');
  }

  private isKycDataEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a && !b) return true;
    if (!a || !b) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  // Compare-and-set prevents concurrent tabs and stale callbacks overwriting newer KYC data.
  private async saveAttempt(userId: string, previous: any, data: any, extra: any = {}, db: any = this.prisma) {
    const kycCondition: Prisma.UserWhereInput =
      previous === null || previous === undefined
        ? { kycData: { equals: Prisma.DbNull } }
        : { kycData: { equals: previous } };

    const result = await db.user.updateMany({
      where: { id: userId, ...kycCondition },
      data: { ...extra, kycData: data },
    });

    if (result.count === 1) {
      return;
    }

    // Fallback check: If the update didn't match due to JSON serialization or encryption in cloud DB,
    // verify if the user's current kycData is actually equivalent to previous before rejecting.
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { kycData: true },
    });

    if (current && this.isKycDataEqual(current.kycData, previous)) {
      const retryResult = await db.user.updateMany({
        where: { id: userId },
        data: { ...extra, kycData: data },
      });
      if (retryResult.count === 1) {
        return;
      }
    }

    throw new ConflictException('KYC changed in another request. Please refresh and try again.');
  }


  /**
   * Helper: Check if user is eligible to update KYC.
   * Enforces: Maximum 2 KYC updates allowed per user in a rolling 1-year window
   * post their 1st successful KYC verification.
   */
  checkKycUpdateEligibility(user: { kycStatus: string; kycData: any }): {
    allowed: boolean;
    hasBeenVerified: boolean;
    updatesThisYear: number;
    updatesRemaining: number;
    nextAvailableDate: Date | null;
    message?: string;
  } {
    const kycData = (user.kycData as any) || {};

    // User is considered to have completed their 1st successful KYC if:
    // 1) firstVerifiedAt is recorded, OR
    // 2) approvedAt is recorded, OR
    // 3) current kycStatus is 'VERIFIED'
    const hasBeenVerified =
      Boolean(kycData.firstVerifiedAt) ||
      Boolean(kycData.approvedAt) ||
      user.kycStatus === 'VERIFIED';

    // If user has never had a successful KYC, the post-verification limit does NOT apply.
    // They can freely fix mistakes and complete their initial KYC onboarding.
    if (!hasBeenVerified) {
      return {
        allowed: true,
        hasBeenVerified: false,
        updatesThisYear: 0,
        updatesRemaining: 2,
        nextAvailableDate: null,
      };
    }

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const oneYearAgo = now - ONE_YEAR_MS;

    const kycUpdates: Array<{ timestamp: string; id?: string }> = Array.isArray(kycData.kycUpdates)
      ? kycData.kycUpdates
      : [];

    // Filter updates executed within the rolling 365-day window
    const recentUpdates = kycUpdates
      .map((u) => ({
        ...u,
        time: new Date(u.timestamp || (u as any)).getTime(),
      }))
      .filter((u) => !isNaN(u.time) && u.time > oneYearAgo)
      .sort((a, b) => a.time - b.time);

    const updatesThisYear = recentUpdates.length;
    const maxUpdates = 2;
    const updatesRemaining = Math.max(0, maxUpdates - updatesThisYear);

    if (updatesThisYear >= maxUpdates) {
      // Oldest update in window will expire 365 days after its recorded timestamp
      const oldestUpdate = recentUpdates[0];
      const nextAvailableDate = new Date(oldestUpdate.time + ONE_YEAR_MS);
      const dateString = nextAvailableDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      return {
        allowed: false,
        hasBeenVerified: true,
        updatesThisYear,
        updatesRemaining: 0,
        nextAvailableDate,
        message: `You have reached the maximum limit of 2 KYC updates allowed per year post-verification. You will be eligible to update your KYC again on ${dateString}. Please contact support if you require urgent changes.`,
      };
    }

    return {
      allowed: true,
      hasBeenVerified: true,
      updatesThisYear,
      updatesRemaining,
      nextAvailableDate: null,
    };
  }

  /**
   * Step 1: Initiate DigiLocker Verification
   */
  async generateDigilockerUrl(userId: string, dto: any): Promise<{ success: boolean; data?: any; message?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // If user is currently verified and initiates DigiLocker, ensure they haven't exceeded annual update limit
    if (user.kycStatus === 'VERIFIED') {
      const eligibility = this.checkKycUpdateEligibility(user);
      if (!eligibility.allowed) {
        throw new BadRequestException(eligibility.message);
      }
      throw new BadRequestException('Reset KYC before starting a new verification.');
    }

    const existingKycData = (user.kycData as any) || {};
    if (existingKycData.attemptState === 'CREATING' &&
        Date.now() - Date.parse(existingKycData.attemptStartedAt) < 60000) {
      throw new ConflictException('A DigiLocker session is already being created. Please wait.');
    }
    if (existingKycData.attemptState === 'PROCESSING' &&
        Date.now() - Date.parse(existingKycData.processingStartedAt) < 60000) {
      throw new ConflictException('DigiLocker verification is already processing. Please wait.');
    }
    if (existingKycData.attemptState === 'AWAITING_CONSENT' && existingKycData.kycUrl &&
        Date.now() - Date.parse(existingKycData.attemptStartedAt) < 5 * 60000) {
      return { success: true, data: { kycUrl: existingKycData.kycUrl } };
    }

    const baseUrl = this.configService.get('DIGITAP_BASE_URL', 'https://api.digitap.ai');
    const clientId = this.configService.get('DIGITAP_CLIENT_ID');
    const clientSecret = this.configService.get('DIGITAP_CLIENT_SECRET');

    // Dynamically route callback to the exact domain the user is visiting from
    const frontendUrl = dto.origin || this.configService.get('FRONTEND_URL', 'http://localhost:3000');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Digitap credentials are not configured.');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const redirectionUrl = `${frontendUrl}/kyc?digilocker_callback=true`;

    // Sanitize name for Digitap: Name must start with alphabets and can only contain digits, dots, underscores, or hyphens.
    let rawFullName = (dto.firstName || user.fullName || 'User').trim();
    rawFullName = rawFullName.replace(/[^a-zA-Z0-9._-\s]/g, '');
    if (!/^[a-zA-Z]/.test(rawFullName)) {
       rawFullName = 'User ' + rawFullName; // Ensure it starts with alphabet
    }

    const [fName, ...rest] = rawFullName.split(' ');
    const lName = rest.length > 0 ? rest.join(' ') : 'NA';
    
    let targetMobile = dto.mobile;
    if (targetMobile && targetMobile.includes('*')) {
       targetMobile = user.phone;
    }
    const cleanMobile = (targetMobile || user.phone || '').replace(/\D/g, '').slice(-10);

    let targetEmail = dto.email;
    if (targetEmail && targetEmail.includes('*')) {
       targetEmail = user.email;
    }

    const payload = {
      serviceId: '4', // Required for DigiLocker
      firstName: fName,
      lastName: lName,
      uid: randomUUID(),
      mobile: cleanMobile,
      emailId: targetEmail || user.email || '', // Correct property is emailId
      isSendOtp: true,
      isHideExplanationScreen: false,
      redirectionUrl,
    };

    const pendingData = {
      ...existingKycData,
      attemptState: 'CREATING',
      attemptStartedAt: new Date().toISOString(),
      digitapTransactionId: null,
      verifiedTransactionId: null,
      kycUrl: null,
      currentKycStep: 0,
      panDetails: null,
      aadhaarDetails: null,
    };
    await this.saveAttempt(userId, user.kycData, pendingData, { kycStatus: 'PENDING' });

    try {
      const response = await fetch(`${baseUrl}/ent/v1/kyc/generate-url`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`
         },
         body: JSON.stringify(payload),
         signal: AbortSignal.timeout(15000),
      });

      const data = await response.json() as any;

      if (!response.ok || String(data.code) !== '200' || !data.model?.transactionId || !data.model?.kycUrl) {
         this.logger.warn(`DigiLocker session creation failed (HTTP ${response.status})`);
         throw new ServiceUnavailableException('Could not start DigiLocker. Please try again shortly.');
      }

      // Store transactionId
      const kycData = {
        ...pendingData,
        attemptState: 'AWAITING_CONSENT',
        kycUrl: data.model.kycUrl,
        digitapTransactionId: data.model.transactionId,
        lastUpdatedStep: new Date().toISOString(),
      };

      await this.saveAttempt(userId, pendingData, kycData);

      return {
        success: true,
        data: { kycUrl: data.model.kycUrl },
      };
    } catch (error) {
      // Do not retry session creation automatically: a timed-out request may have succeeded.
      try {
        await this.saveAttempt(userId, pendingData, { ...pendingData, attemptState: 'FAILED' });
      } catch {
        // Ignore conflict during cleanup
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException('Could not generate DigiLocker URL. Please try again shortly.');
    }
  }

  /**
   * Step 2: Fetch Details from DigiLocker Activity
   */
  async fetchDigilockerDetails(userId: string): Promise<{ success: boolean; message: string; data?: any }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const kycData = (user.kycData as any) || {};
    const transactionId = kycData.digitapTransactionId;


    if (!transactionId) {
      throw new BadRequestException('No active DigiLocker session found.');
    }
    if (hasCurrentDigilockerVerification(kycData)) {
      return { success: true, message: 'DigiLocker details already verified' };
    }
    if (kycData.attemptState === 'PROCESSING' &&
        Date.now() - Date.parse(kycData.processingStartedAt) < 60000) {
      throw new ConflictException('DigiLocker verification is already processing. Please refresh shortly.');
    }

    const baseUrl = this.configService.get('DIGITAP_BASE_URL', 'https://api.digitap.ai');
    const clientId = this.configService.get('DIGITAP_CLIENT_ID');
    const clientSecret = this.configService.get('DIGITAP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Digitap credentials are not configured.');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const payload = { transactionId };
    const processingData = {
      ...kycData,
      attemptState: 'PROCESSING',
      processingStartedAt: new Date().toISOString(),
    };
    await this.saveAttempt(userId, user.kycData, processingData);

    try {
        const response = await fetch(`${baseUrl}/ent/v1/kyc/get-digilocker-details`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`
         },
         body: JSON.stringify(payload),
         signal: AbortSignal.timeout(15000),
       });

       const data = await response.json() as any;

       if (!response.ok || String(data.code) !== '200') {
           if (response.status === 429 || response.status >= 500) {
             throw new ServiceUnavailableException('DigiLocker is temporarily unavailable. Please try again shortly.');
           }
           throw new BadRequestException('DigiLocker verification was not completed. Please complete verification and try again.');
       }

       const model = data.model || {};

       const digilockerFiles: Array<{ docLink: string; docType: string; docExtension: string }> =
         data.digilockerFiles || model.digilockerFiles || [];

       let extractedPanFromXml = '';

       // If PAN is missing from JSON, dynamically fetch and parse the XML document from S3/DigiLocker
       const panXmlFile = digilockerFiles.find(f => f.docType === 'PANCR' && f.docExtension === 'xml' && f.docLink);
       if (panXmlFile) {
         try {
           const xmlRes = await fetch(panXmlFile.docLink, { signal: AbortSignal.timeout(10000) });
           if (xmlRes.ok) {
             const xmlText = await xmlRes.text();
             const panMatch = xmlText.match(/<PAN[^>]*\bnum="([^"]+)"/i) || xmlText.match(/<Certificate[^>]*\bnumber="([^"]+)"/i);
             if (panMatch && panMatch[1]) {
                extractedPanFromXml = panMatch[1].toUpperCase();
             }
           }
         } catch (err) {
           this.logger.warn(`Failed to parse PAN XML for user ${userId}`, err as Error);
         }
       }

       const identity = validateDigilockerIdentity(model, extractedPanFromXml);

       const updatedKycData = {
          ...kycData,
          verifiedTransactionId: transactionId,
          attemptState: 'READY',
          currentKycStep: 1, 
          
          // Elevate key info to root for easier frontend access
          fullName: model.aadhaar?.name || model.pan?.name || model.pan?.nameOnCard || model.name || kycData.fullName,
          dob: model.aadhaar?.dob || model.pan?.dob || model.dob || kycData.dob,
          fatherName: model.aadhaar?.fatherName || model.fatherName || model.careOf || kycData.fatherName,
          address: model.aadhaar?.address || model.address || kycData.address,
          
          panDetails: {
             pan: identity.pan,
             name: model.pan?.name || model.pan?.nameOnCard || model.name || '',
             dob: model.pan?.dob || model.dob || '',
             verified: true,
             verifiedAt: new Date().toISOString()
          },
          aadhaarDetails: {
             aadhaar: identity.aadhaar,
             name: model.aadhaar?.name || model.name || '',
             dob: model.aadhaar?.dob || model.dob || '',
             gender: model.aadhaar?.gender || model.gender || '',
             fatherName: model.aadhaar?.fatherName || model.fatherName || model.careOf || '',
             address: model.aadhaar?.address || model.address || '',
             photo: model.image || model.aadhaar?.photo || model.photo || '',
             verified: true,
             verifiedAt: new Date().toISOString()
          },
          digitapDetails: model, // Store raw
          lastUpdatedStep: new Date().toISOString(),
       };

       // Derive the verified name from Aadhaar/KYC data to use as the user's display name
       const verifiedName = updatedKycData.fullName || updatedKycData.aadhaarDetails?.name || user.fullName;

       // Serialize claims for the same PAN across all replicas. Keep network calls outside
       // this short transaction. A hash collision only serializes unrelated identities.
       await this.prisma.$transaction(async (tx) => {
         await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.pan}, 0))::text AS locked`;
         const existingUser = await tx.user.findFirst({
           where: {
             id: { not: userId },
             kycData: { path: ['panDetails', 'pan'], equals: identity.pan },
           },
           select: { id: true },
         });
         if (existingUser) {
           throw new BadRequestException('This PAN is already linked to another account. Please use your original account or contact support.');
         }
         await this.saveAttempt(userId, processingData, updatedKycData, {
             kycStatus: 'PENDING',
             // Update the user's display name from Aadhaar (authoritative source)
             ...(verifiedName ? { fullName: verifiedName } : {}),
         }, tx);
         // Persist documents atomically with the winning attempt, including against reset.
         await tx.kycDocument.deleteMany({ where: { userId } });
         if (digilockerFiles.length) {
           await tx.kycDocument.createMany({
             data: digilockerFiles.map(file => ({
               userId,
               docType: file.docType,
               docExtension: file.docExtension,
               docLink: file.docLink,
               status: 'FETCHED',
               fetchedAt: new Date(),
               expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
               metadata: { source: 'digilocker', transactionId },
             })),
           });
         }
       });

       // Send KYC Pending (Received) email
       try {
         if (user.email) {
           await this.emailService.sendKycPendingEmail({
             email: user.email,
             fullName: (updatedKycData as any).fullName || user.fullName || 'User',
           });
         }
       } catch (emailError) {
         this.logger.warn(`Failed to send KYC_PENDING email for user ${userId}`, emailError as Error);
       }

       return {
          success: true,
          message: 'DigiLocker details verified successfully',
          data: model
       };

    } catch (error) {
       try {
         await this.saveAttempt(userId, processingData, { ...kycData, attemptState: 'AWAITING_CONSENT' });
       } catch {
         // Ignore conflict during cleanup
       }
       if (error instanceof HttpException) throw error;
       this.logger.warn('DigiLocker details request failed');
       throw new ServiceUnavailableException('Could not verify DigiLocker details. Please try again shortly.');
    }
  }

  /**
   * Submit bank details for verification
   */
  async submitBankDetails(
    userId: string,
    dto: SubmitBankDetailsDto,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update kycData with bank details
    const kycData = (user.kycData as any) || {};
    
    let matchScore = 0;
    const aadhaarName = kycData.aadhaarDetails?.name || user.fullName || '';
    if (aadhaarName && dto.accountHolderName) {
      // Mock score logic: if names are similar
      matchScore = aadhaarName.toLowerCase() === dto.accountHolderName.toLowerCase() ? 100 : 85;
    } else {
      matchScore = 60; // Mock score if partial info
    }
    
    const isVerified = matchScore >= 50;

    const bankDetailsObj = {
      accountNumber: dto.accountNumber,
      ifsc: dto.ifsc,
      accountHolder: dto.accountHolderName,
      beneficiaryName: dto.accountHolderName, // in reality, from penny drop API
      bankName: 'HDFC Bank', // mocked
      branchName: 'Koramangala', // mocked
      matchScore: matchScore,
      verified: isVerified,
      verifiedAt: new Date().toISOString(),
    };

    const updatedKycData = {
      ...kycData,
      currentKycStep: 3,
      bankDetails: bankDetailsObj,
      lastUpdatedStep: new Date().toISOString(),
    };

    await this.saveAttempt(userId, user.kycData, updatedKycData);

    return {
      success: true,
      message: 'Bank details processed successfully',
      data: bankDetailsObj,
    };
  }

  /**
   * Upload KYC document
   */
  async uploadDocument(
    userId: string,
    documentType: string,
    file: FileData,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    // Validate document type
    // Simplified mock KYC: only 3 documents are supported.
    const validTypes = ['panCard', 'aadhaarFront', 'aadhaarBack'];
    if (!validTypes.includes(documentType)) {
      throw new BadRequestException(
        `Invalid document type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and PDF are allowed',
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Create user-specific directory
    const userDir = path.join(this.uploadsDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    const filename = `${documentType}-${timestamp}-${random}${ext}`;
    const filepath = path.join(userDir, filename);

    // Write buffer to file
    fs.writeFileSync(filepath, file.buffer);

    // Prepare document metadata
    const documentMetadata = {
      url: `uploads/kyc/${userId}/${filename}`,
      uploadedAt: new Date().toISOString(),
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    // Update user's kycDocuments and documentsUploaded tracker
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const kycData = (user?.kycData as any) || {};

    const updatedKycData = {
      ...kycData,
      // Step 2 represents the document upload stage in the simplified flow.
      // We never want to move the user backwards if legacy data exists.
      currentKycStep: Math.max(Number(kycData.currentKycStep || 0), 2),
      documentsUploaded: {
        ...(kycData.documentsUploaded || {}),
        [documentType]: true,
      },
      lastUpdatedStep: new Date().toISOString(),
    };

    await this.saveAttempt(userId, user.kycData, updatedKycData);

    return {
      success: true,
      message: 'Document uploaded successfully',
      data: { url: documentMetadata.url },
    };
  }

  /**
   * Submit KYC for final review
   */
  async submitKYC(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const kycData = (user.kycData as any) || {};

    if (user.kycStatus === 'VERIFIED') {
      return { success: true, message: 'KYC already verified.' };
    }
    if (!hasCurrentDigilockerVerification(kycData)) {
      throw new BadRequestException('Complete PAN and Aadhaar verification in the current DigiLocker session before submitting.');
    }

    // For DigiLocker flow, we skipped physical uploads for PAN and Aadhaar.
    // If further documents like Bank Proof are needed later, add checks here.

    const now = new Date().toISOString();
    // Record firstVerifiedAt on the initial successful KYC completion
    const firstVerifiedAt = kycData.firstVerifiedAt || now;

    // Update user with VERIFIED status because DigiLocker automates it
    await this.saveAttempt(userId, user.kycData, {
          ...kycData,
          attemptState: 'VERIFIED',
          firstVerifiedAt,
          submittedAt: now,
          approvedAt: now,
    }, { kycStatus: 'VERIFIED' });

    // Send instantaneous KYC approved notification
    try {
      if (user.email) {
        await this.emailService.sendKycVerifiedEmail({
          email: user.email,
          fullName: user.fullName || 'User',
        });
      }
      await this.notificationsService.createNotification(
        userId,
        NotificationType.KYC_VERIFIED,
        'KYC Verified',
        'Your KYC has been securely verified via DigiLocker.',
        { redirectUrl: '/dashboard' },
      );
    } catch (error) {
      this.logger.warn(`Failed to auto-notify KYC_VERIFIED for user ${userId}`, error as Error);
    }

    // Auto-create user ledger if all 3 verifications are now complete
    await this.tryCreateUserLedger(userId);

    return {
      success: true,
      message: 'KYC verified successfully.',
    };
  }

  /**
   * Check if all 3 verifications are complete, and auto-create user ledger if so.
   */
  private async tryCreateUserLedger(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true, dematStatus: true, bankStatus: true },
    });
    if (user && user.kycStatus === 'VERIFIED' && user.dematStatus === 'VERIFIED' && user.bankStatus === 'VERIFIED') {
      try {
        await this.accountingService.createUserLedger(userId);
      } catch (err) {
        this.logger.error(`Failed to auto-create user ledger for ${userId}:`, err);
      }
    }
  }

  /**
   * Get KYC status for user
   */
  async getKycStatus(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        kycData: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const kycData = (user.kycData as any) || {};

    // Check if all steps are complete for the simplified flow.
    const panVerified = kycData.panDetails?.verified || false;

    // Legacy fields kept for backward compatibility with older clients.
    // New clients should rely on `submittedAt` and the documentsUploaded map.
    const aadhaarVerified = kycData.aadhaarDetails?.verified || false;
    const bankVerified = kycData.bankDetails?.verified || false;

    const documentsUploaded = {
      // Physical PAN/Aadhaar photos deprecated by DigiLocker integration
    };

    // In the new flow, submit is allowed once PAN is verified (via DigiLocker).
    const canSubmit = hasCurrentDigilockerVerification(kycData);
    const eligibility = this.checkKycUpdateEligibility(user);

    return {
      kycStatus: user.kycStatus,
      attemptState: kycData.attemptState || null,
      currentKycStep: kycData.currentKycStep || 0,
      submittedAt: kycData.submittedAt || null,
      firstVerifiedAt: kycData.firstVerifiedAt || null,
      panVerified,
      aadhaarVerified,
      bankVerified,
      documentsUploaded,
      canSubmit,
      // 2 KYC updates allowed per year post 1st successful KYC
      hasBeenVerified: eligibility.hasBeenVerified,
      kycUpdatesCount: eligibility.updatesThisYear,
      kycUpdatesRemaining: eligibility.updatesRemaining,
      maxKycUpdatesPerYear: 2,
      canUpdateKyc: eligibility.allowed,
      nextKycUpdateAvailableAt: eligibility.nextAvailableDate ? eligibility.nextAvailableDate.toISOString() : null,
    };
  }

  /**
   * Reset KYC for a user so they can redo it.
   * Enforces max 2 KYC updates per year post 1st successful KYC.
   * Clears KYC step state and documents while preserving update audit history.
   */
  async resetKyc(userId: string): Promise<{ success: boolean; message: string; kycUpdatesRemaining?: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true, kycData: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check eligibility: max 2 updates per rolling year post-verification
    const eligibility = this.checkKycUpdateEligibility(user);
    if (!eligibility.allowed) {
      throw new BadRequestException(eligibility.message);
    }

    const kycData = (user.kycData as any) || {};
    const now = new Date().toISOString();

    let updatedHistory = Array.isArray(kycData.kycUpdates) ? [...kycData.kycUpdates] : [];
    let firstVerifiedAt = kycData.firstVerifiedAt;

    if (eligibility.hasBeenVerified) {
      if (!firstVerifiedAt) {
        firstVerifiedAt = kycData.approvedAt || kycData.submittedAt || now;
      }
      updatedHistory.push({
        id: `kyc-upd-${Date.now()}`,
        timestamp: now,
        previousStatus: user.kycStatus,
      });
    }

    // Reset KYC form data while strictly preserving firstVerifiedAt and update history
    const newKycData = {
      firstVerifiedAt,
      kycUpdates: updatedHistory,
      currentKycStep: 0,
      resetAt: now,
    };

    await this.prisma.$transaction(async (tx) => {
      await this.saveAttempt(userId, user.kycData, newKycData, { kycStatus: 'PENDING' }, tx);
      await tx.kycDocument.deleteMany({ where: { userId } });
    });

    const updatesUsed = eligibility.hasBeenVerified ? eligibility.updatesThisYear + 1 : 0;
    const remaining = eligibility.hasBeenVerified ? Math.max(0, 2 - updatesUsed) : 2;

    this.logger.log(
      `KYC reset for user ${userId} (previous status: ${user.kycStatus}, updates this year: ${updatesUsed})`,
    );

    return {
      success: true,
      message: `KYC has been reset. You can now redo your KYC verification.${
        eligibility.hasBeenVerified ? ` (${remaining} of 2 updates remaining this year)` : ''
      }`,
      kycUpdatesRemaining: remaining,
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  async sendKycStatusEmail(
    userId: string,
    status: 'VERIFIED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user || !user.email) {
      return { success: false, message: 'User not found or email missing' };
    }

    if (status === 'VERIFIED') {
      await this.emailService.sendKycVerifiedEmail({
        email: user.email,
        fullName: user.fullName || 'User',
      });
      return { success: true, message: 'KYC verified email sent' };
    } else if (status === 'REJECTED') {
      await this.emailService.sendKycRejectedEmail(
        {
          email: user.email,
          fullName: user.fullName || 'User',
        },
        rejectionReason ||
          'KYC verification failed. Please retry with correct information.',
      );
      return { success: true, message: 'KYC rejected email sent' };
    }

    return { success: false, message: 'Invalid KYC status' };
  }
}
