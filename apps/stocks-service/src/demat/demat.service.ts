import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from 'email-service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-types';
import { LinkDematDto } from './dto/link-demat.dto';
import { AccountingService } from '../accounting/accounting.service';
import { Prisma } from 'db-unlistedstock';
import { PinoNestLogger } from '@smc/logger';

interface FileData {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class DematService {
  private readonly logger = new PinoNestLogger('stocks-service', 'DematService');

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private accountingService: AccountingService,
  ) {}

  private validateDocumentData(docData: any, documentName: string): void {
    // Validate fileUrl format
    if (!docData.fileUrl || typeof docData.fileUrl !== 'string') {
      throw new BadRequestException(
        `${documentName}: Invalid document data format`,
      );
    }

    // Validate file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (docData.fileSize > maxSizeBytes) {
      throw new BadRequestException(
        `${documentName}: File size exceeds 5MB limit`,
      );
    }

    // Validate filename
    if (!docData.fileName || typeof docData.fileName !== 'string') {
      throw new BadRequestException(`${documentName}: Invalid filename`);
    }
  }

  async linkDemat(userId: string, dto: LinkDematDto) {
    // Check if user exists and KYC is verified
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== 'VERIFIED') {
      throw new BadRequestException(
        'KYC verification required before linking Demat account',
      );
    }

    // A new submission replaces the existing details and starts a fresh review.
    // The current details remain active until this request is submitted.

    // Validate dematStatement document
    this.validateDocumentData(dto.dematStatement, 'Demat Statement');

    // Proceed to create the PENDING request for Admin Review.
    // The actual CDSL/NSDL commercial API is not yet integrated for auto-verification,
    // so we rely on the manual admin approval workflow.

    // Extract DP ID and Client ID
    const upperAccountNumber = dto.accountNumber.toUpperCase();
    let dpId = '';
    let clientId = '';
    
    // NSDL format: IN + 14 digits (total 16). DP ID = first 8 chars (IN + 6 digits), Client ID = last 8 digits
    // CDSL format: 16 digits. DP ID = first 8 chars (8 digits), Client ID = last 8 digits
    dpId = upperAccountNumber.substring(0, 8);
    clientId = upperAccountNumber.substring(8, 16);

    // Update user's demat data and status
    const dematData = {
      type: 'link',
      accountNumber: dto.accountNumber,
      dpId,
      clientId,
      lastUpdatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };

    // Prepare dematDocuments with uploaded statement URL
    const dematDocuments = {
      dematStatement: {
        fileUrl: dto.dematStatement.fileUrl,
        uploadedAt: new Date().toISOString(),
        fileName: dto.dematStatement.fileName,
        fileSize: dto.dematStatement.fileSize,
      },
    };

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        dematData: dematData,
        dematDocuments: dematDocuments,
        dematStatus: 'PENDING',
      },
    });

    // Send email notification
    await this.emailService.sendDematLinkedEmail(updatedUser, dematData);

    // Create in-app notification (best-effort)
    try {
      await this.notificationsService.createNotification(
        userId,
        NotificationType.DEMAT_LINKED,
        'Demat Details Submitted',
        'Your Demat account details were submitted successfully and are pending admin review.',
        {
          redirectUrl: '/profile',
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create DEMAT_LINKED notification for user ${userId}`,
        error as Error,
      );
    }

    this.logger.log('Demat account submitted for review for user:', userId);

    return {
      success: true,
      message: 'Demat account details submitted successfully for admin review',
      data: {
        dematStatus: 'PENDING',
        accountNumber: dto.accountNumber.replace(/.(?=.{4})/g, '*'), // Mask account number
      },
    };
  }

  async adminApproveDemat(userId: string, adminId?: string, adminEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.dematStatus !== 'PENDING') {
      throw new BadRequestException(`Demat account cannot be approved (current status: ${user.dematStatus})`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        dematStatus: 'VERIFIED',
      },
    });

    this.logger.log(`Demat approved for user ${userId} by admin ${adminEmail || adminId}`);

    // Send Demat Verified email
    try {
      if (updatedUser.email) {
        await this.emailService.sendDematStatusEmail(
          {
            email: updatedUser.email,
            fullName: updatedUser.fullName,
          },
          'VERIFIED',
          undefined,
          updatedUser.dematData
        );
      }
    } catch (emailError) {
      this.logger.warn(`Failed to send DEMAT_VERIFIED email for user ${userId}`, emailError as Error);
    }

    // Create in-app notification
    try {
      await this.notificationsService.createNotification(
        userId,
        NotificationType.DEMAT_LINKED,
        'Application Approved',
        'Your application is approved successfully',
        { redirectUrl: '/dashboard' },
      );
    } catch (e) {
      this.logger.warn(`Failed to notify user ${userId}`, e as Error);
    }

    // Auto-create user ledger if all 3 verifications are now complete
    await this.tryCreateUserLedger(userId);

    return {
      success: true,
      message: 'Demat account approved successfully',
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

  async adminRejectDemat(userId: string, reason: string, adminId?: string, adminEmail?: string) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.dematStatus !== 'PENDING') {
      throw new BadRequestException(`Demat account cannot be rejected (current status: ${user.dematStatus})`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        dematStatus: 'REJECTED',
        dematData: {
          ...(user.dematData as object || {}),
          rejectionReason: reason,
        }
      },
    });

    this.logger.log(`Demat rejected for user ${userId} by admin ${adminEmail || adminId}. Reason: ${reason}`);

    // Send Demat Rejected email
    try {
      if (updatedUser.email) {
        await this.emailService.sendDematStatusEmail(
          {
            email: updatedUser.email,
            fullName: updatedUser.fullName,
          },
          'REJECTED',
          reason,
          updatedUser.dematData
        );
      }
    } catch (emailError) {
      this.logger.warn(`Failed to send DEMAT_REJECTED email for user ${userId}`, emailError as Error);
    }

    // Create in-app notification
    try {
      await this.notificationsService.createNotification(
        userId,
        NotificationType.DEMAT_LINKED,
        'Application Rejected',
        `Your application is rejected. Reason -- ${reason}`,
        { redirectUrl: '/demat' },
      );
    } catch (e) {
      this.logger.warn(`Failed to notify user ${userId}`, e as Error);
    }

    return {
      success: true,
      message: 'Demat account rejected',
    };
  }

  async uploadDematDocument(
    userId: string,
    documentType: string,
    fileData: { fileUrl: string; fileName: string; fileSize: number },
  ) {
    // Validate document type
    const validDocumentTypes = ['dematStatement'];
    if (!validDocumentTypes.includes(documentType)) {
      throw new BadRequestException(
        `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}`,
      );
    }

    // Size and Mime validation is now handled by the storage-service microservice.
    // We implicitly trust the URL received from the frontend after successful storage validation.

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get existing documents or create new object
    const currentDocuments = (user.dematDocuments as any) || {};

    // Update document configuration to use the S3 remote URL
    const updatedDocuments = {
      ...currentDocuments,
      [documentType]: {
        fileUrl: fileData.fileUrl,
        uploadedAt: new Date().toISOString(),
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
      },
    };

    // Update user's demat documents
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        dematDocuments: updatedDocuments,
      },
    });

    this.logger.log(
      `📄 Document uploaded successfully: ${documentType} for user ${userId}`,
    );

    return {
      success: true,
      message: 'Document uploaded and linked successfully',
      data: {
        documentType,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileUrl: fileData.fileUrl,
        uploadedAt: updatedDocuments[documentType].uploadedAt,
      },
    };
  }

  async getDematStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        dematStatus: true,
        dematData: true,
        dematDocuments: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const dematData = user.dematData as any;
    const dematDocuments = user.dematDocuments as any;

    // Sanitize data (remove sensitive info, keep structure)
    const sanitizedDematData = dematData
      ? {
          type: dematData.type,
          accountNumber: dematData.accountNumber
            ? dematData.accountNumber.replace(/(?<=.{12}).*/g, '****')
            : null,
          dpId: dematData.dpId,
          clientId: dematData.clientId,
          lastUpdatedAt: dematData.lastUpdatedAt,
          submittedAt: dematData.submittedAt,
        }
      : null;

    // Check document upload status (without returning actual data)
    const documentStatus = {
      dematStatement: !!dematDocuments?.dematStatement,
    };

    return {
      success: true,
      data: {
        dematStatus: user.dematStatus,
        kycVerified: user.kycStatus === 'VERIFIED',
        dematData: sanitizedDematData,
        documentsUploaded: documentStatus,
        canLinkOrCreate:
          user.kycStatus === 'VERIFIED' && user.dematStatus !== 'VERIFIED',
      },
    };
  }

  /**
   * Reset Demat for a user so they can redo it.
   * Clears dematData, dematDocuments and sets dematStatus back to PENDING.
   */
  async resetDemat(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, dematStatus: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        dematStatus: 'PENDING',
        dematData: Prisma.JsonNull,
        dematDocuments: Prisma.JsonNull,
      },
    });

    this.logger.log(`Demat reset for user ${userId} (previous status: ${user.dematStatus})`);

    return {
      success: true,
      message: 'Demat verification has been reset. You can now redo your Demat linking.',
    };
  }
}
