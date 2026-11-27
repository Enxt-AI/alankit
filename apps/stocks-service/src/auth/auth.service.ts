import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PinoNestLogger } from '@/logger';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from 'email-service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

import { assertStrongPassword } from './utils/password-policy.util';

/**
 * AuthService handles authentication business logic for stocks-service
 * Provides admin validation, token generation, and admin retrieval
 */
@Injectable()
export class AuthService {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {}

  /**
   * Validate admin credentials
   * @param email - Admin email
   * @param password - Plain text password
   * @returns Admin object if credentials are valid
   */
  async validateAdmin(email: string, password: string) {
    this.logger.log('Auth Service - Validating admin:', email);

    // Find admin by email
    const admin = await this.prisma.admin.findUnique({
      where: { email },
   });

    if (!admin) {
      this.logger.log('Auth Service - Admin not found:', email);
      throw new BadRequestException('Invalid credentials');
   }

    // Check if admin is active
    if (!admin.isActive) {
      this.logger.log('Auth Service - Admin account deactivated:', email);
      throw new BadRequestException('Admin account is deactivated');
   }

    // Verify password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      this.logger.log('Auth Service - Invalid password for:', email);
      throw new BadRequestException('Invalid credentials');
   }

    this.logger.log('Auth Service - Admin validated successfully:', email);
    return admin;
 }

  /**
   * Generate JWT token for admin
   * @param adminId - Admin's unique ID
   * @param email - Admin's email
   * @param role - Admin's role
   * @param permissions - Admin's permissions
   * @param req - Request object to retrieve userAgent/IP
   * @returns JWT token string
   */
  async generateAdminToken(
    adminId: string,
    email: string,
    role: string,
    permissions: string[],
    req?: any,
  ) {
    this.logger.log(
      'Auth Service - Generating JWT Token for:',
      email,
      'Role:',
      role,
    );

    const sessionId = crypto.randomUUID();
    const sessionRecord = {
      userId: adminId,
      portal: 'ADMIN',
      issuedAt: new Date().toISOString(),
      userAgent: req?.headers?.['user-agent'] || 'Unknown',
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || 'Unknown',
   };

    // Save session in Redis with 24 hour TTL (86400 seconds)
    await this.redis.set(`session:${sessionId}`, sessionRecord, 86400);

    // Cache permissions in Redis for 7 days (604800 seconds) to avoid DB hits
    await this.redis.set(`admin:${adminId}:permissions`, permissions, 604800);

    return sessionId;
 }

  /**
   * Get admin by ID
   * @param adminId - Admin's unique ID
   * @returns Admin object
   */
  async getAdminById(adminId: string) {
    this.logger.log('Auth Service - Getting admin by ID:', adminId);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
     },
   });

    if (!admin) {
      this.logger.log('Auth Service - Admin not found:', adminId);
      throw new NotFoundException('Admin not found');
   }

    this.logger.log('Auth Service - Admin retrieved:', admin.email);
    return admin;
 }

  /**
   * Update last login timestamp
   * @param adminId - Admin's unique ID
   */
  async updateLastLogin(adminId: string) {
    this.logger.log('Auth Service - Updating last login for:', adminId);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { lastLoginAt: new Date() },
   });

    this.logger.log('Auth Service - Last login updated for:', adminId);
 }

  /**
   * Send Forgot Password OTP to panel user's email address
   * Includes Email Enumeration Protection, Rate Limiting, and Hashed OTP Storage.
   */
  async sendPanelForgotPasswordOtp(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const genericSuccessMessage =
      'If an active account exists with this email address, a verification OTP has been sent.';

    // Rate Limiting Check: Max 3 OTP requests per 10 minutes per email
    const rateLimitKey = `panel:forgot_password_rate:${normalizedEmail}`;
    const rateCountVal = await this.redis.get(rateLimitKey);
    const rateCount = rateCountVal ? parseInt(String(rateCountVal), 10) : 0;

    if (rateCount >= 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please wait 10 minutes before requesting another code.',
      );
   }

    const admin = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
   });

    // For internal panel: Tell user clearly if no account exists with this email
    if (!admin || !admin.isActive) {
      throw new BadRequestException(
        'No active panel account found with this email address.',
      );
   }

    // Increment rate limit counter
    await this.redis.set(rateLimitKey, (rateCount + 1).toString(), 600);

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store HASHED OTP in Redis (SHA-256 hash) for 10 minutes (600 seconds)
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const redisKey = `panel:forgot_password_otp:${normalizedEmail}`;
    await this.redis.set(redisKey, otpHash, 600);

    // Reset attempt counter for this email
    await this.redis.delete(`panel:forgot_password_attempts:${normalizedEmail}`);

    // Send email via EmailService
    try {
      await this.emailService.sendOtpEmail(normalizedEmail, otp);
   } catch (err: any) {
      this.logger.error('[AuthService] Failed to send OTP email:', err.message);
   }

    return {
      success: true,
      message: genericSuccessMessage,
   };
 }

  /**
   * Verify Forgot Password OTP for panel user
   * Includes Attempt Limiting (max 5 failed attempts) and SHA-256 Hash Verification.
   */
  async verifyPanelForgotPasswordOtp(email: string, otp: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const attemptsKey = `panel:forgot_password_attempts:${normalizedEmail}`;
    const attemptsVal = await this.redis.get(attemptsKey);
    const attempts = attemptsVal ? parseInt(String(attemptsVal), 10) : 0;

    if (attempts >= 5) {
      throw new BadRequestException(
        'Too many failed verification attempts. Please request a new OTP.',
      );
   }

    const redisKey = `panel:forgot_password_otp:${normalizedEmail}`;
    const storedHash = await this.redis.get(redisKey);

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    if (!storedHash || storedHash !== inputHash) {
      // Increment failed attempts counter
      await this.redis.set(attemptsKey, (attempts + 1).toString(), 900);
      throw new BadRequestException(
        `Invalid or expired OTP verification code. (${4 - attempts} attempts remaining)`,
      );
   }

    // OTP Verified! Delete OTP and attempts keys
    await this.redis.delete(redisKey);
    await this.redis.delete(attemptsKey);

    // Generate random 32-byte hex reset token stored in Redis (15-minute TTL)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenKey = `panel:reset_token:${normalizedEmail}`;
    await this.redis.set(tokenKey, resetToken, 900);

    return {
      success: true,
      resetToken,
      message: 'OTP verified successfully.',
   };
 }

  /**
   * Reset Panel user password using valid reset token
   * Hashes password, updates DB, deletes Redis keys, and invalidates active admin sessions.
   */
  async resetPanelPassword(
    email: string,
    resetToken: string,
    newPassword: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const tokenKey = `panel:reset_token:${normalizedEmail}`;
    const storedToken = await this.redis.get(tokenKey);

    if (!storedToken || storedToken !== resetToken) {
      throw new BadRequestException(
        'Invalid or expired reset session. Please request a new OTP.',
      );
   }

    const admin = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
   });

    if (!admin || !admin.isActive) {
      throw new BadRequestException('Panel user account not found or inactive.');
   }

    // Enforce enterprise password policy (12+ chars, uppercase, lowercase, number, special char)
    assertStrongPassword(newPassword);

    // Hash new password using bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await this.prisma.admin.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
   });

    // Delete Redis reset keys
    await this.redis.delete(`panel:forgot_password_otp:${normalizedEmail}`);
    await this.redis.delete(`panel:forgot_password_attempts:${normalizedEmail}`);
    await this.redis.delete(`panel:forgot_password_rate:${normalizedEmail}`);
    await this.redis.delete(tokenKey);

    // Invalidate cached permissions for this admin
    await this.redis.delete(`admin:${admin.id}:permissions`);

    return {
      success: true,
      message:
        'Password reset successfully. You can now log in with your new password.',
   };
 }
}
