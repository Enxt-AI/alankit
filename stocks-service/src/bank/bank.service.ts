import {
  Injectable,
  BadRequestException,
  NotFoundException,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from 'email-service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-types';
import { LinkBankDto } from './dto/link-bank.dto';
import { AccountingService } from '../accounting/accounting.service';
import { Prisma } from 'db-unlisted-stox';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class BankService {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private configService: ConfigService,
    private accountingService: AccountingService,
    @InjectQueue('digitap-bank-verification') private bankQueue: Queue,
  ) {}

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
   * Link and verify bank account (Queued via Bull).
   * Calls Digitap penny-drop API in a concurrency-controlled queue.
   */
  async linkBank(userId: string, dto: LinkBankDto) {
    let result: any;
    try {
      this.logger.log(`Enqueuing Digitap bank verification for user ${userId}`);
      const job = await this.bankQueue.add(
        'verify-bank',
        { userId, dto },
        {
          removeOnComplete: true,
          removeOnFail: 100,
          timeout: 60000,
       },
      );
      result = await job.finished();
   } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('ECONNREFUSED') ||
        msg.includes('NR_CLOSED') ||
        msg.includes('Connection is closed') ||
        msg.includes('Redis connection') ||
        msg.includes('queue is paused')
      ) {
        this.logger.warn(`Redis queue unavailable (${msg}), executing direct bank verification for user ${userId}`);
        result = await this.processLinkBank(userId, dto);
     } else {
        this.logger.error(`Bank verification job failed: ${msg}`);
        throw new BadRequestException(msg || 'Could not process bank verification at this time. Please try again.');
     }
   }

    if (result?.error) {
      if (result.statusCode === 404) {
        throw new NotFoundException(result.message);
     }
      if (result.verification) {
        throw new BadRequestException({
          statusCode: result.statusCode || 400,
          message: result.message,
          error: 'Bad Request',
          verification: result.verification,
       });
     }
      throw new BadRequestException(result.message);
   }

    return result;
 }

  /**
   * Core logic for Digitap bank account verification.
   * Called by DigitapBankProcessor or directly as a fallback.
   */
  async processLinkBank(userId: string, dto: LinkBankDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
   });

    if (!user) {
      return { error: true, statusCode: 404, message: 'User not found' };
   }

    if (user.bankStatus === 'VERIFIED') {
      return { error: true, statusCode: 400, message: 'Bank account already linked and verified' };
   }

    // 1. 24-hour Verification Limit
    if (user.lastBankVerificationAttempt) {
      const hoursSinceLastAttempt = (Date.now() - user.lastBankVerificationAttempt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAttempt < 24) {
        return {
          error: true,
          statusCode: 400,
          message: 'You can only attempt bank verification once every 24 hours. Please try again later.',
       };
     }
   }

    // 1.5. 12-Month Verification Limit (Max 3 successful accounts in 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const recentVerifications = (user.successfulBankVerifications || []).filter(d => new Date(d) >= twelveMonthsAgo);
    if (recentVerifications.length >= 3) {
      return {
        error: true,
        statusCode: 400,
        message: 'You have reached the maximum limit of 3 bank account changes in a 12-month period.',
     };
   }

    // 2. Aadhaar Uniqueness Check
    const kycData = user.kycData as any;
    const aadhaar = kycData?.aadhaarDetails?.aadhaar;

    if (aadhaar) {
      const existingAadhaarUser = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          bankStatus: 'VERIFIED',
          kycData: {
            path: ['aadhaarDetails', 'aadhaar'],
            equals: aadhaar,
         },
       },
        select: { id: true },
     });

      if (existingAadhaarUser) {
        return {
          error: true,
          statusCode: 400,
          message: 'This Aadhaar number is already linked to another verified bank account.',
       };
     }
   }

    // 3. Record the attempt immediately before any 3rd party calls
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastBankVerificationAttempt: new Date() },
   });

    const baseUrl = this.configService.get('DIGITAP_BASE_URL', 'https://api.digitap.ai');
    const clientId = this.configService.get('DIGITAP_CLIENT_ID');
    const clientSecret = this.configService.get('DIGITAP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.error('Digitap credentials are not configured.');
      return {
        error: true,
        statusCode: 400,
        message: 'Server configuration error: Bank verification unavailable',
     };
   }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const clientRefNum = `BANK-${userId.slice(0, 8)}-${Date.now()}`;

    const payload = {
      ifsc: dto.ifsc,
      accNo: dto.accNo,
      benificiaryName: dto.benificiaryName || user.fullName || '',
      paymentMode: "IMPS",
      clientRefNum,
   };

    // Send Bank Verification Submitted email (Background)
    try {
      if (user.email) {
        this.emailService.sendBankLinkedEmail(
          {
            email: user.email,
            fullName: user.fullName,
         },
          { accNo: dto.accNo }
        ).catch(err => this.logger.warn(`Failed to send bank submission email for user ${userId}`, err));
     }
   } catch (e) {}

    try {
      const response = await fetch(`${baseUrl}/penny-drop/v2/check-valid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ent_authorization': authString,
       },
        body: JSON.stringify(payload),
     });

      const data = await response.json() as any;

      if (!response.ok || (data.code && data.code.toString() !== "200")) {
        this.logger.error(`Digitap API rejected bank verification: ${JSON.stringify(data)}`);
        const msg = data.msg || data.message || 'Bank verification failed. Please check your account details.';
        return {
          error: true,
          statusCode: 400,
          message: `Bank Verification Failed: ${msg}`,
       };
     }

      if (data.model && data.model.status && !['TXN_SUCCESS', 'VALID', 'SUCCESS'].includes(data.model.status)) {
         this.logger.error(`Digitap API Verification failure (Internal Status): ${JSON.stringify(data)}`);
         return {
           error: true,
           statusCode: 400,
           message: `Bank Verification Failed: Invalid Account details provided.`,
        };
     }

      // ── Enrich bank details from Razorpay IFSC API (free, no auth needed) ──
      let ifscData: any = {};
      try {
        const ifscCode = data.model?.ifsc || dto.ifsc;
        if (ifscCode) {
          const ifscResponse = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
          if (ifscResponse.ok) {
            ifscData = await ifscResponse.json() as any;
            this.logger.log(`IFSC lookup for ${ifscCode}: ${ifscData.BANK} - ${ifscData.BRANCH}`);
         }
       }
     } catch (ifscError) {
        this.logger.warn('Razorpay IFSC lookup failed (non-blocking)', ifscError);
     }

      // ── Name Matching (compute score for every attempt) ──
      const bankNameDesc = (data.model?.beneficiaryName || data.model?.clientName || data.model?.name || '').trim();
      const userProfileName = (user.fullName || '').trim();

      let isMatch = false;
      let nameMatchScore = 0;

      if (bankNameDesc && userProfileName) {
        const normalizedUser = userProfileName.toLowerCase();
        const normalizedBank = bankNameDesc.toLowerCase();

        const userWords = normalizedUser.split(/\s+/).filter(w => w.length > 1);
        const bankWords = normalizedBank.split(/\s+/).filter(w => w.length > 1);

        if (userWords.length > 0 && bankWords.length > 0) {
          // 1. Exact Match
          if (normalizedUser === normalizedBank) {
            isMatch = true;
            nameMatchScore = 100;
         }
          // 2. First Name Match
          else if (userWords[0] === bankWords[0]) {
            isMatch = true;
            let matchedWords = 0;
            for (const word of userWords) {
              if (bankWords.includes(word)) matchedWords++;
           }
            nameMatchScore = Math.max(Math.round((matchedWords / userWords.length) * 100), 70);
         }
          // 3. 50% Word Match
          else {
            let matchedWords = 0;
            for (const word of userWords) {
              if (bankWords.includes(word)) matchedWords++;
           }
            nameMatchScore = Math.round((matchedWords / userWords.length) * 100);
            if (nameMatchScore >= 50) isMatch = true;
         }
       }
     }

      // Helper: mask account number (show last 4 digits)
      const maskedAccNo = dto.accNo.length > 4
        ? '••••••••' + dto.accNo.slice(-4)
        : dto.accNo;

      // Build verification details shared by both success and error paths
      const verification = {
        accountNumber: maskedAccNo,
        accountType: data.model?.accountType || 'Savings',
        bankName: data.model?.bankName || ifscData.BANK || '',
        branchName: data.model?.branchName || ifscData.BRANCH || '',
        nameProvided: userProfileName,
        nameAtBank: bankNameDesc,
        nameMatchStatus: isMatch ? 'MATCHED' : 'NOT_MATCHED',
        nameMatchScore,
        accountStatus: 'Active',
        ifscValid: Boolean(ifscData.IFSC || data.model?.ifsc),
        amlStatus: 'CLEARED',
        referenceId: clientRefNum,
        verifiedAt: new Date().toISOString(),
     };

      // ── Name mismatch → reject with verification details ──
      if (!isMatch && bankNameDesc && userProfileName) {
        this.logger.warn(`Name mismatch for user ${userId}: Profile(${userProfileName}) vs Bank(${bankNameDesc})`);
        return {
          error: true,
          statusCode: 400,
          message: `Kindly use your own account to add or link here. The name on the bank account (${bankNameDesc}) does not match your registered name.`,
          verification,
       };
     }

      // ── Success path ──
      const bankData = {
        ifsc: data.model?.ifsc || dto.ifsc,
        accNo: dto.accNo,
        benificiaryName: bankNameDesc || userProfileName,
        bankName: verification.bankName,
        branchName: verification.branchName,
        city: data.model?.city || ifscData.CITY || '',
        state: data.model?.state || ifscData.STATE || '',
        micr: data.model?.micr || ifscData.MICR || '',
        pennyDropStatus: 'SUCCESS',
        digitapDetails: data.model || data,
        lastUpdatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
     };

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          bankData: bankData,
          bankStatus: 'VERIFIED',
          successfulBankVerifications: {
            push: new Date()
         }
       },
     });

      // Send Bank Verified email
      try {
        if (user.email) {
          await this.emailService.sendBankStatusEmail(
            {
              email: user.email,
              fullName: user.fullName,
           },
            'VERIFIED',
            undefined,
            bankData
          );
       }
     } catch (emailError) {
        this.logger.warn(`Failed to send BANK_VERIFIED email for user ${userId}`, emailError as Error);
     }

      try {
        await this.notificationsService.createNotification(
          userId,
          'BANK_LINKED' as any,
          'Bank Verified Successfully',
          'Your bank details have been successfully verified.',
          { redirectUrl: '/profile' },
        );
     } catch (e) {
        this.logger.warn(`Failed to notify user ${userId}`, e);
     }

      // Auto-create user ledger if all 3 verifications are now complete
      await this.tryCreateUserLedger(userId);

      return {
        success: true,
        message: 'Bank verification successful',
        data: {
          bankStatus: 'VERIFIED',
          verification,
       },
     };

   } catch (error: any) {
      this.logger.error('Digitap Penny Drop error', error);
      return {
        error: true,
        statusCode: 400,
        message: error?.message || 'Could not process bank verification at this time. Please try again.',
     };
   }
 }

  async getBankStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        bankStatus: true,
        bankData: true,
     },
   });

    if (!user) {
      throw new NotFoundException('User not found');
   }

    const bankData = user.bankData as any;

    const sanitizedData = bankData
      ? {
          ...bankData,
          accNo: bankData.accNo ? bankData.accNo.replace(/.(?=.{4})/g, '*') : null,
       }
      : null;

    return {
      success: true,
      data: {
        bankStatus: user.bankStatus,
        bankData: sanitizedData,
     },
   };
 }

  async adminApproveBank(userId: string, adminId?: string, adminEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
   });
    if (!user) throw new NotFoundException('User not found');

    if (user.bankStatus !== 'PENDING') {
      throw new BadRequestException(`Bank account cannot be approved (current status: ${user.bankStatus})`);
   }

    await this.prisma.user.update({
      where: { id: userId },
      data: { bankStatus: 'VERIFIED' },
   });

    // Send Bank Verified email
    try {
      if (user.email) {
        await this.emailService.sendBankStatusEmail(
          {
            email: user.email,
            fullName: user.fullName,
         },
          'VERIFIED',
          undefined,
          user.bankData
        );
     }
   } catch (emailError) {
      this.logger.warn(`Failed to send BANK_VERIFIED email for user ${userId}`, emailError as Error);
   }

    // Auto-create user ledger if all 3 verifications are now complete
    await this.tryCreateUserLedger(userId);

    return { success: true, message: 'Bank account approved successfully' };
 }

  async adminRejectBank(userId: string, reason: string, adminId?: string, adminEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
   });
    if (!user) throw new NotFoundException('User not found');

    if (user.bankStatus !== 'PENDING') {
      throw new BadRequestException(`Bank account cannot be rejected (current status: ${user.bankStatus})`);
   }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        bankStatus: 'REJECTED',
        bankData: {
          ...(user.bankData as object || {}),
          rejectionReason: reason,
       },
     },
   });

    // Send Bank Rejected email
    try {
      if (user.email) {
        await this.emailService.sendBankStatusEmail(
          {
            email: user.email,
            fullName: user.fullName,
         },
          'REJECTED',
          reason,
          user.bankData
        );
     }
   } catch (emailError) {
      this.logger.warn(`Failed to send BANK_REJECTED email for user ${userId}`, emailError as Error);
   }

    return { success: true, message: 'Bank account rejected successfully' };
 }

  /**
   * Reset Bank for a user so they can redo it.
   * Clears bankData and sets bankStatus back to PENDING.
   */
  async resetBank(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, bankStatus: true },
   });

    if (!user) {
      throw new NotFoundException('User not found');
   }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        bankStatus: 'PENDING',
        bankData: Prisma.JsonNull,
     },
   });

    this.logger.log(`Bank reset for user ${userId} (previous status: ${user.bankStatus})`);

    return {
      success: true,
      message: 'Bank verification details have been reset. You can now redo bank verification.',
   };
 }
}
