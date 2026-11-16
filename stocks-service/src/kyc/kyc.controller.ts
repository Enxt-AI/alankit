import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { KycService, FileData } from './kyc.service';
import { SubmitBankDetailsDto } from './dto/submit-bank-details.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

/**
 * KYC Controller - Multi-step KYC verification flow
 * Provides endpoints for PAN, Aadhaar, Bank, and Document verification
 *
 * Feature flag: When external KYC integration is active, the mock KYC
 * endpoints return a 400 response directing the client to use the
 * external KYC flow via /api/kyc-integration/initiate instead.
 */
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
  ) {}



  /**
   * Step 1: Initiate DigiLocker Verification
   */
  @Post('digilocker/generate-url')
  @UseGuards(JwtAuthGuard)
  async generateDigilockerUrl(@Req() req: any, @Body() dto: any) {
    const userId = req.user.userId;
    // Add validation if needed, assuming the frontend passes mobile, firstName, etc. if required.
    // For now we can pull from user profile or the dto itself.
    return await this.kycService.generateDigilockerUrl(userId, dto);
  }

  /**
   * Step 2: Fetch Details from DigiLocker Activity
   */
  @Post('digilocker/fetch-details')
  @UseGuards(JwtAuthGuard)
  async fetchDigilockerDetails(@Req() req: any) {
    const userId = req.user.userId;
    return await this.kycService.fetchDigilockerDetails(userId);
  }


  /**
   * Step 3: Submit bank details for verification
   * Blocked when external KYC integration is active.
   */
  @Post('bank-details')
  @UseGuards(JwtAuthGuard) // Per-endpoint guard
  async submitBankDetails(@Req() req: any, @Body() dto: SubmitBankDetailsDto) {

    const userId = req.user.userId;
    return await this.kycService.submitBankDetails(userId, dto);
  }

  /**
   * Step 4: Upload KYC document
   * Document types: panCard, aadhaarFront, aadhaarBack
   * Blocked when external KYC integration is active.
   */
  @Post('upload-document/:documentType')
  @UseGuards(JwtAuthGuard) // Per-endpoint guard
  async uploadDocument(
    @Req() req: any,
    @Param('documentType') documentType: string,
  ) {

    const userId = req.user.userId;

    try {
      // Get the uploaded file using Fastify multipart
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/pdf',
      ];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only JPEG, PNG, and PDF files are allowed',
        );
      }

      // Convert file to buffer and validate size
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      // Create file data object for the service
      const fileData: FileData = {
        originalname: data.filename,
        buffer: buffer,
        mimetype: data.mimetype,
        size: buffer.length,
      };

      return await this.kycService.uploadDocument(
        userId,
        documentType,
        fileData,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload document');
    }
  }

  /**
   * Step 5: Submit KYC for final review
   * Blocked when external KYC integration is active.
   */
  @Post('submit')
  @UseGuards(JwtAuthGuard) // Per-endpoint guard
  async submitKYC(@Req() req: any, @Body() dto: SubmitKycDto) {

    const userId = req.user.userId;
    return await this.kycService.submitKYC(userId);
  }

  /**
   * Get current KYC status and progress
   * Always allowed (regardless of external KYC), as it is read-only.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard) // Per-endpoint guard
  async getKycStatus(@Req() req: any) {
    const userId = req.user.userId;
    return await this.kycService.getKycStatus(userId);
  }

  /**
   * Reset KYC so user can redo it
   */
  @Post('reset')
  @UseGuards(JwtAuthGuard)
  async resetKyc(@Req() req: any) {
    const userId = req.user.userId;
    return await this.kycService.resetKyc(userId);
  }

}
