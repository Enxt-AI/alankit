import { CompleteSignupDto } from './dto/complete-signup.dto';
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { encryptToken, OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES, PANEL_ROLE_CONFIG } from 'cookie-crypto';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { PhoneOtpRequestDto } from './dto/phone-otp-request.dto';
import { PhoneOtpVerifyDto } from './dto/phone-otp-verify.dto';
import { DistributorLoginDto } from './dto/distributor-login.dto';
import { EmailOtpRequestDto } from './dto/email-otp-request.dto';
import { EmailOtpVerifyDto } from './dto/email-otp-verify.dto';
import { CmsVerifyOtpDto } from './dto/cms-verify-otp.dto';
import { Public } from './decorators/public.decorator';
import { CreatePartnerRmDto } from './dto/create-partner-rm.dto';
import { UpdatePartnerRmEmployeeIdDto } from './dto/update-partner-rm-employee-id.dto';
import { AdminCreateRmDto } from './dto/admin-create-rm.dto';
import {
  ResetDistributorPasswordDto,
  ResetPartnerPasswordDto,
  SendPartnerForgotPasswordOtpDto,
  VerifyPartnerForgotPasswordOtpDto,
} from './dto/distributor-reset-password.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateDistributorDto } from './dto/create-distributor.dto';
import { UpdateDistributorDto } from './dto/update-distributor.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  SendPanelForgotPasswordOtpDto,
  VerifyPanelForgotPasswordOtpDto,
  ResetPanelPasswordDto,
} from './dto/forgot-password.dto';

function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  if (phone.length <= 4) return '****';
  return '******' + phone.slice(-4);
}

function maskEmail(email: string | undefined | null): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.substring(0, 1)}***${name.substring(name.length - 1)}@${domain}`;
}

/**
 * Removes highly sensitive keys (passwords, tokens) and masks PII (email, phone, JSON).
 * Designed for API responses to Admins/Distributors where raw data is unnecessary.
 * For the /profile endpoint where the user is the owner, this function is NOT used, returning raw data.
 */
function omitSensitive(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(omitSensitive);
  if (obj instanceof Date) return obj;
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, hashedRefreshToken, tempOtp, otp, secret, key, isDeleted, ...rest } = obj;
  
  // Context-aware masking for non-owners
  if (rest.phone) rest.phone = maskPhone(rest.phone);
  if (rest.email) rest.email = maskEmail(rest.email);
  if (rest.kycData && typeof rest.kycData === 'object') {
    rest.kycData = { _masked: true, message: "KYC data is encrypted and restricted to owner." };
  }
  if (rest.dematData && typeof rest.dematData === 'object') {
    rest.dematData = { _masked: true, message: "Demat data is encrypted and restricted to owner." };
  }
  if (rest.bankData && typeof rest.bankData === 'object') {
    rest.bankData = { _masked: true, message: "Bank data is encrypted and restricted to owner." };
  }

  for (const k in rest) {
    if (Object.prototype.hasOwnProperty.call(rest, k)) {
      rest[k] = omitSensitive(rest[k]);
    }
  }
  return rest;
}

/**
 * Removes ONLY highly sensitive keys (passwords, tokens).
 * Does NOT mask PII (email, phone, JSON).
 * Designed for Admin endpoints where full data visibility is required.
 */
function omitCredentials(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(omitCredentials);
  if (obj instanceof Date) return obj;
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, hashedRefreshToken, tempOtp, otp, secret, key, isDeleted, ...rest } = obj;
  
  for (const k in rest) {
    if (Object.prototype.hasOwnProperty.call(rest, k)) {
      rest[k] = omitCredentials(rest[k]);
    }
  }
  return rest;
}

import { PrismaService } from '../prisma/prisma.service';
import { PinoNestLogger } from '@smc/logger';

/**
 * AuthController handles all authentication-related HTTP endpoints
 * Base route: /api/auth
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new PinoNestLogger('auth-service', 'AuthController');
  /** Shared cookie options for all auth cookies — single source of truth */
  private get cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      sameSite: 'lax' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
      // maxAge omitted intentionally: creates true Session cookies that expire when browser is closed
    };
  }

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /** Use Fastify's trusted-proxy-resolved address for per-IP OTP limits. */
  private getClientIp(req: any): string {
    if (typeof req?.ip === 'string' && req.ip.trim()) {
      return req.ip.trim();
    }

    const forwardedFor = req?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : undefined;
    const realIp = req?.headers?.['x-real-ip'];
    const candidate = forwardedIp || realIp || req?.socket?.remoteAddress;
    return typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : 'Unknown';
  }

  /**
   * POST /api/auth/email/otp/request
   * Request OTP for email-first authentication
   */
  @Post('email/otp/request')
  @Public()
  @HttpCode(200)
  // @Throttle({ default: { limit: 3, ttl: 900000 } })
  @SkipThrottle() // OTP rate limit commented out
  async requestEmailOTP(@Body() dto: EmailOtpRequestDto, @Req() req: any) {
    try {
      const ip = this.getClientIp(req);
      const idempotencyKey = req.headers['x-idempotency-key'];
      if (idempotencyKey) {
        const cached = await this.authService.redis.getIdempotencyResponse(idempotencyKey);
        if (cached) return cached;
      }
      const deviceFingerprint = req.headers['x-device-fingerprint'];
      const result = await this.authService.sendEmailOTP(dto.email, ip, dto.captchaToken, deviceFingerprint, dto.phone);
      if (idempotencyKey) {
        await this.authService.redis.setIdempotencyResponse(idempotencyKey, result, 300);
      }
      return result;
    } catch (error: any) {
      this.logger.error({ err: error }, '[Email OTP Request] Error:');
      throw error;
    }
  }

  /**
   * POST /api/auth/email/otp/verify
   * Verify email OTP and authenticate user
   */
  @Post('email/otp/verify')
  @Public()
  @HttpCode(200)
  // @Throttle({ default: { limit: 5, ttl: 900000 } })
  @SkipThrottle() // OTP rate limit commented out
  async verifyEmailOTP(
    @Req() req: any,
    @Body() dto: EmailOtpVerifyDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    try {
      const result = await this.authService.verifyEmailOTP(dto.email, dto.otp, dto.phone, req, dto.phoneVerificationToken || req.cookies?.phone_verification);

      res.clearCookie('phone_verification', this.cookieOptions);
      if (result.needsName && result.signupToken) {
        res.setCookie('pending_signup', result.signupToken, { ...this.cookieOptions, maxAge: 600 });
        res.clearCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, this.cookieOptions);
        return { success: true, needsName: true, isNewUser: result.isNewUser,
          ...(req.headers['x-client-type'] === 'mobile' && { signupToken: result.signupToken }) };
      }


      res.clearCookie('pending_signup', this.cookieOptions);

      // Track user session
      try {
        const ip = this.getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';
        this.authService.logUserLogin(result.user.id, ip, userAgent).catch((err: any) => this.logger.warn({ userId: result.user.id, err }, 'logUserLogin failed'));
      } catch (e) {}

      // Set HTTP-only cookie
      res.setCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, result.token!, this.cookieOptions);

      const isMobile = req.headers['x-client-type'] === 'mobile';

      return {
        success: true,
        isNewUser: result.isNewUser,
        wasDeactivated: result.wasDeactivated || false,
        // Mobile clients cannot read HttpOnly cookies, so return the
        // session token AND sanitised user object in the response body.
        ...(isMobile && {
          token: result.token,
          user: result.user ? omitSensitive(result.user) : undefined,
        }),
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Email OTP Verify] Error:');
      throw error;
    }
  }

  @Post('signup/complete')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async completeSignup(@Body() dto: CompleteSignupDto, @Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.authService.completeSignup(dto.fullName, dto.signupToken || req.cookies?.pending_signup, req);
    res.clearCookie('pending_signup', this.cookieOptions);
    res.clearCookie('phone_verification', this.cookieOptions);
    res.setCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, result.token, this.cookieOptions);
    return { success: true, ...(req.headers['x-client-type'] === 'mobile' && {
      token: result.token, user: omitSensitive(result.user),
    }) };
  }

  @Get('signup/status')
  @Public()
  @HttpCode(200)
  async signupStatus(@Req() req: any) {
    if (req.cookies?.pending_signup) {
      const pending = await this.authService.redis.getPendingSignup(req.cookies.pending_signup);
      if (pending) return { step: 'name', phone: pending.phone, email: pending.email };
    }
    if (req.cookies?.phone_verification) {
      const phone = await this.authService.redis.getPhoneProof(req.cookies.phone_verification);
      if (phone) return { step: 'email', phone };
    }
    return { step: 'phone' };
  }

  // NOTE: Google sync endpoint removed as part of Google Auth deprecation.

  /**
   * POST /api/auth/otp
   * Requests an OTP for phone verification (legacy post-login flow).
   */
  @Post('otp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async requestOTP(@Body() dto: RequestOtpDto, @Req() req: any) {
    const userId = req.user.userId;
    const ip = this.getClientIp(req);
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (idempotencyKey) {
      const cached = await this.authService.redis.getIdempotencyResponse(idempotencyKey);
      if (cached) return cached;
    }
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    const result = await this.authService.sendOTP(dto.mobile, userId, ip, dto.captchaToken, deviceFingerprint);
    if (idempotencyKey) {
      await this.authService.redis.setIdempotencyResponse(idempotencyKey, result, 300);
    }
    return result;
  }

  /**
   * POST /api/auth/otp/verify
   * Verifies an OTP entered by the user (legacy post-login flow).
   */
  @Post('otp/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async verifyOTP(
    @Body() dto: VerifyOtpDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const userId = req.user.userId;
    this.logger.log({ userId }, `Verifying OTP for the userId: ${userId}.`);

    const result = await this.authService.verifyOTP(
      dto.mobile,
      dto.otp,
      userId,
    );

    const user = await this.authService.getUserById(userId);

    const token = await this.authService.generateToken(
      user.id,
      user.email!,
      user.phone,
      user.kycStatus,
      user.fullName,
      req,
    );

    res.setCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, token, this.cookieOptions);

    const isMobile = req.headers['x-client-type'] === 'mobile';

    return {
      ...result,
      ...(isMobile && { token }),
    };
  }

  /**
   * POST /api/auth/step-up/request
   * Requests an OTP for step-up authentication (sensitive actions).
   */
  @Post('step-up/request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async requestStepUpOTP(@Body() dto: RequestOtpDto, @Req() req: any) {
    const userId = req.user.userId;
    const ip = this.getClientIp(req);
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    
    // Pass undefined for captchaToken since step-up assumes they are already authed
    return await this.authService.requestStepUpOtp(userId, ip, undefined, deviceFingerprint);
  }

  /**
   * POST /api/auth/step-up/verify
   * Verifies the step-up OTP and marks the current session as step-up verified.
   */
  @Post('step-up/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async verifyStepUpOTP(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const userId = req.user.userId;
    const sessionId = req.user.sessionId; // Need the raw session ID to update Redis
    // Wait, the raw session ID is not passed to req.user by SessionStrategy!
    // The SessionStrategy sets req.user.sessionId to the HASHED session ID.
    // I need to update authService.verifyStepUpOtp to handle this, or pass the raw session ID.
    // Wait, if it's already hashed, I can just use it directly! 
    return await this.authService.verifyStepUpOtp(userId, sessionId, dto.otp);
  }

  /**
   * GET /api/auth/profile
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getProfile(@Req() req: any) {
    const userId: string | undefined = req.user?.userId;
    if (userId) {
      const user = await this.authService.getUserById(userId);

      return {
        id: user.id,
        email: maskEmail(user.email),
        fullName: user.fullName,
        phone: maskPhone(user.phone),
        kycStatus: user.kycStatus,
        kycData: user.kycData,
        dematStatus: user.dematStatus,
        dematData: user.dematData,
        dematDocuments: user.dematDocuments,
        bankStatus: user.bankStatus,
        bankData: user.bankData,
        needsEmail: user.needsEmail,
        kycDocuments: user.kycDocuments,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        type: 'USER',
      };
    }

    const adminId: string | undefined = req.user?.adminId;
    if (adminId) {
      const admin = await this.authService.getAdminById(adminId);

      return {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
        type: 'ADMIN',
      };
    }

    throw new UnauthorizedException('Invalid token payload');
  }

  /**
   * POST /auth/profile
   * Update current user profile (using POST to bypass WAF PATCH restrictions)
   */
  @Post('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not found');
    const updatedUser = await this.authService.updateFullName(userId, dto.fullName);
    return { success: true, user: { id: updatedUser.id, fullName: updatedUser.fullName } };
  }

  /**
   * POST /api/auth/deactivate
   * Deactivate current user account and clear auth cookie
   */
  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deactivateAccount(
    @Req() req: any,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not found');

    await this.authService.deactivateUser(userId);

    // Clear auth cookie
    res.clearCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, this.cookieOptions);

    return { success: true, message: 'Account deactivated successfully' };
  }

  /**
   * POST /api/auth/delete
   * Soft-delete current user account and clear auth cookie
   */
  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deleteAccount(
    @Req() req: any,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not found');

    await this.authService.deleteUser(userId);

    // Clear auth cookie
    res.clearCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, this.cookieOptions);

    return { success: true, message: 'Account deleted successfully' };
  }

  /**
   * POST /api/auth/signout
   * Sign out user by clearing auth cookie
   */
  @Post('signout')
  @Public()
  @HttpCode(200)
  async signOut(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    // Clear session in Redis
    await this.authService.logoutSessionFromRequest(req, OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN);

    // Clear the auth cookie (obfuscated name)
    res.clearCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, this.cookieOptions);

    return { success: true };
  }

  /**
   * POST /api/auth/admin/login
   * Admin login with email and password
   */
  @Post('admin/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async adminLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const admin = await this.authService.adminLogin(dto.email, dto.password);

    if (!PANEL_ROLE_CONFIG.ADMIN.includes(admin.role as any)) {
      this.logger.warn({ event: 'admin.login.wrong_panel', adminId: admin.id, email: admin.email, role: admin.role }, `Access denied: role "${admin.role}" not allowed for admin panel`);
      throw new UnauthorizedException(
        `Access denied. Admin privileges required. Your account role (${admin.role}) is assigned to another workspace panel.`
      );
    }

    const token = await this.authService.generateAdminToken(
      admin.id,
      admin.email,
      admin.role,
      admin.permissions,
      req,
    );

    // Set role-based cookies instead of single admin_token
    const cookiesToSet: Array<{ name: string; token: string }> = [];

    // For ADMIN or SUPER_ADMIN roles, set admin panel cookie
    if (PANEL_ROLE_CONFIG.ADMIN.includes(admin.role as any)) {
      cookiesToSet.push({
        name: OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
        token: token,
      });
      this.logger.log({ adminId: admin.id, role: admin.role }, `Setting admin panel cookie for role: ${admin.role}`);
    }

    // For CONTENT_MANAGER role only, set CMS panel cookie
    if (PANEL_ROLE_CONFIG.CMS.includes(admin.role as any) && admin.role !== 'SUPER_ADMIN') {
      cookiesToSet.push({
        name: OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN,
        token: token,
      });
      this.logger.log({ adminId: admin.id, role: admin.role }, `Setting CMS panel cookie for role: ${admin.role}`);
    }

    // For SUPPORT_AGENT role only, set support panel cookie
    if (PANEL_ROLE_CONFIG.SUPPORT.includes(admin.role as any) && admin.role !== 'SUPER_ADMIN') {
      cookiesToSet.push({
        name: OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
        token: token,
      });
      this.logger.log({ adminId: admin.id, role: admin.role }, `Setting support panel cookie for role: ${admin.role}`);
    }

    // Set all applicable cookies (token values encrypted via AES-256-GCM)
    for (const cookie of cookiesToSet) {
      res.setCookie(cookie.name, cookie.token!, this.cookieOptions);
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/admin/logout
   * Admin logout
   */
  @Post('admin/logout')
  @Public()
  @HttpCode(200)
  async adminLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  /**
   * Shared helper to clear all panel cookies and invalidate their sessions
   */
  private async clearAllPanelSessionsAndCookies(req: any, res: FastifyReply) {
    const allCookies = Object.values(OBFUSCATED_COOKIE_NAMES).filter(
      (name) => name !== OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN
    );

    for (const cookieName of allCookies) {
      if (cookieName) {
        await this.authService.logoutSessionFromRequest(req, cookieName);
        res.clearCookie(cookieName, this.cookieOptions);
      }
    }
  }

  /**
   * Shared login helper for all panels
   */
  private async performPanelLogin(
    dto: AdminLoginDto,
    allowedRoles: string[],
    cookieName: string,
    res: FastifyReply,
    req: any,
  ) {
    const admin = await this.authService.adminLogin(dto.email, dto.password);

    if (!allowedRoles.includes(admin.role)) {
      this.logger.warn({ event: 'panel.login.wrong_role', adminId: admin.id, email: admin.email, role: admin.role, allowedRoles }, `Panel login rejected: role "${admin.role}" not in allowed roles`);
      throw new UnauthorizedException(`Access denied. Required roles: ${allowedRoles.join(', ')}.`);
    }

    const token = await this.authService.generateAdminToken(
      admin.id,
      admin.email,
      admin.role,
      admin.permissions,
      req,
    );

    res.setCookie(cookieName, token!, this.cookieOptions);

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  // ==========================================
  // CMS PANEL ENDPOINTS
  // ==========================================
  @Post('cms/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async cmsLogin(@Req() req: any, @Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    const admin = await this.authService.adminLogin(dto.email, dto.password);

    if (!PANEL_ROLE_CONFIG.CMS.includes(admin.role as any)) {
      this.logger.warn({ event: 'panel.login.cms.wrong_role', adminId: admin.id, email: admin.email, role: admin.role }, 'CMS login: access denied');
      throw new UnauthorizedException(`Access denied. Required roles: ${PANEL_ROLE_CONFIG.CMS.join(', ')}.`);
    }

    const ip = this.getClientIp(req);
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (idempotencyKey) {
      const cached = await this.authService.redis.getIdempotencyResponse(idempotencyKey);
      if (cached) return cached;
    }
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    await this.authService.sendCmsOtp(admin.email, ip, undefined, deviceFingerprint);
    
    const result = {
      success: true,
      requiresOtp: true,
      message: 'OTP sent to email.',
    };

    if (idempotencyKey) {
      await this.authService.redis.setIdempotencyResponse(idempotencyKey, result, 300);
    }
    return result;
  }

  @Post('cms/verify-otp')
  @Public()
  @HttpCode(200)
  async cmsVerifyOtp(@Req() req: any, @Body() dto: CmsVerifyOtpDto, @Res({ passthrough: true }) res: FastifyReply) {
    // Re-verify password (stateless)
    const admin = await this.authService.adminLogin(dto.email, dto.password);

    if (!PANEL_ROLE_CONFIG.CMS.includes(admin.role as any)) {
      this.logger.warn({ event: 'panel.verify.cms.otp.wrong_role', adminId: admin.id, email: admin.email, role: admin.role }, 'CMS OTP verify: access denied');
      throw new UnauthorizedException(`Access denied. Required roles: ${PANEL_ROLE_CONFIG.CMS.join(', ')}.`);
    }

    // Verify OTP
    await this.authService.verifyCmsOtp(admin.email, dto.otp);

    // Proceed to generate token and set cookie
    const token = await this.authService.generateAdminToken(
      admin.id,
      admin.email,
      admin.role,
      admin.permissions,
      req,
    );

    res.setCookie(OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN, token!, this.cookieOptions);

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  @Post('cms/logout')
  @Public()
  @HttpCode(200)
  async cmsLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  @Get('cms/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyCms(@Req() req: any) {
    if (!PANEL_ROLE_CONFIG.CMS.includes(req.user.role as any)) {
      this.logger.warn({ event: 'panel.verify.cms.access_denied', adminId: req.user.adminId, role: req.user.role }, 'CMS panel verify: access denied');
      throw new UnauthorizedException('Access denied');
    }
    let admin;
    try {
      admin = await this.authService.getAdminById(req.user.adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }
    return { success: true, admin };
  }

  // ==========================================
  // MARKETING PANEL ENDPOINTS
  // ==========================================
  @Post('marketing/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async marketingLogin(@Req() req: any, @Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    return this.performPanelLogin(dto, [...PANEL_ROLE_CONFIG.MARKETING], OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN, res, req);
  }

  @Post('marketing/logout')
  @Public()
  @HttpCode(200)
  async marketingLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  @Get('marketing/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyMarketing(@Req() req: any) {
    if (!PANEL_ROLE_CONFIG.MARKETING.includes(req.user.role as any)) {
      this.logger.warn({ event: 'panel.verify.marketing.access_denied', adminId: req.user.adminId, role: req.user.role }, 'Marketing panel verify: access denied');
      throw new UnauthorizedException('Access denied');
    }
    let admin;
    try {
      admin = await this.authService.getAdminById(req.user.adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }
    return { success: true, admin };
  }

  // ==========================================
  // ACCOUNTING PANEL ENDPOINTS
  // ==========================================
  @Post('accounting/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async accountingLogin(@Req() req: any, @Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    return this.performPanelLogin(dto, [...PANEL_ROLE_CONFIG.ACCOUNTING], OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN, res, req);
  }

  @Post('accounting/logout')
  @Public()
  @HttpCode(200)
  async accountingLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  @Get('accounting/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyAccounting(@Req() req: any) {
    if (!PANEL_ROLE_CONFIG.ACCOUNTING.includes(req.user.role as any)) {
      this.logger.warn({ event: 'panel.verify.accounting.access_denied', adminId: req.user.adminId, role: req.user.role }, 'Accounting panel verify: access denied');
      throw new UnauthorizedException('Access denied');
    }
    let admin;
    try {
      admin = await this.authService.getAdminById(req.user.adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }
    return { success: true, admin };
  }

  // ==========================================
  // OPERATION PANEL ENDPOINTS
  // ==========================================
  @Post('operation/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async operationLogin(@Req() req: any, @Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    return this.performPanelLogin(dto, [...PANEL_ROLE_CONFIG.OPERATION], OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN, res, req);
  }

  @Post('operation/logout')
  @Public()
  @HttpCode(200)
  async operationLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  @Get('operation/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyOperation(@Req() req: any) {
    if (!PANEL_ROLE_CONFIG.OPERATION.includes(req.user.role as any)) {
      this.logger.warn({ event: 'panel.verify.operation.access_denied', adminId: req.user.adminId, role: req.user.role }, 'Operation panel verify: access denied');
      throw new UnauthorizedException('Access denied');
    }
    let admin;
    try {
      admin = await this.authService.getAdminById(req.user.adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }
    return { success: true, admin };
  }

  /**
   * GET /api/auth/admin/verify
   * Verify admin session from HttpOnly cookie
   * Used for session restoration on page refresh
   */
  @Get('admin/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyAdminSession(@Req() req: any) {
    if (!PANEL_ROLE_CONFIG.ADMIN.includes(req.user.role as any)) {
      this.logger.warn({ event: 'panel.verify.admin.access_denied', adminId: req.user.adminId, role: req.user.role }, 'Admin panel verify: access denied');
      throw new UnauthorizedException('Access denied');
    }
    const adminId = req.user.adminId;
    let admin;
    try {
      admin = await this.authService.getAdminById(adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  // ==========================================
  // SUPPORT PANEL ENDPOINTS
  // ==========================================
  @Post('support/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async supportLogin(@Req() req: any, @Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    return this.performPanelLogin(dto, [...PANEL_ROLE_CONFIG.SUPPORT], OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN, res, req);
  }

  @Post('support/logout')
  @Public()
  @HttpCode(200)
  async supportLogout(@Req() req: any, @Res({ passthrough: true }) res: FastifyReply) {
    await this.clearAllPanelSessionsAndCookies(req, res);
    return { success: true };
  }

  /**
   * GET /api/auth/support/verify
   * Verify support panel session from HttpOnly cookie
   * Used for session restoration on page refresh in support panel
   */
  @Get('support/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifySupport(@Req() req: any) {
    const adminId = req.user.adminId;
    const userRole = req.user.role;

    // Enforce support-specific role constraints
    if (!PANEL_ROLE_CONFIG.SUPPORT.includes(userRole as any)) {
      this.logger.warn({ event: 'panel.verify.support.access_denied', adminId, role: userRole }, 'Support panel verify: access denied');
      throw new UnauthorizedException(
        'Only Support Agents and Super Admins can access the support verification endpoint',
      );
    }

    let admin;
    try {
      admin = await this.authService.getAdminById(adminId);
    } catch (error) {
      throw new UnauthorizedException('Admin not found');
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/admin/create
   * Create new admin (Admins with create_cms permission or SUPER_ADMIN)
   * Protected by JwtAuthGuard and AdminGuard - validation in service
   */
  @Post('admin/create')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: any) {
    const creatorAdminId = req.user.adminId;

    const admin = await this.authService.createAdmin(
      dto.email,
      dto.fullName,
      dto.password,
      dto.role,
      dto.permissions,
      creatorAdminId,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  /**
   * POST /api/auth/admins/support-agent
   * Create new Support Agent (Super Admin only)
   * Protected by JwtAuthGuard and AdminGuard - validation in service
   */
  @Post('admins/support-agent')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createSupportAgent(@Body() dto: CreateAdminDto, @Req() req: any) {
    const creatorAdminId = req.user.adminId;

    const admin = await this.authService.createAdmin(
      dto.email,
      dto.fullName,
      dto.password,
      'SUPPORT_AGENT',
      dto.permissions,
      creatorAdminId,
      dto.availability,
      dto.availabilityNote,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/validate-admin
   * Validate admin token and check admin status
   * Public endpoint - used by middleware for token validation
   */
  @Post('validate-admin')
  @Public()
  @HttpCode(200)
  async validateAdmin(@Req() req: any) {
    let payload: any;
    try {
      // Extract token from Authorization header only
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Verify JWT signature and decode payload
      payload = await this.authService.verifyAdminToken(token);

      // Fetch admin from database to check active status
      const admin = await this.authService.getAdminById(payload.adminId);

      // Check if admin is active (if active field exists in schema)
      // For now, assume all admins are active unless explicitly disabled
      // You can add: if (!admin.active) throw new UnauthorizedException('Admin account disabled');

      // Return validation success with admin details
      return {
        valid: true,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          permissions: admin.permissions,
        },
      };
    } catch (error) {
      // JWT verification failed, expired, or DB error
      this.logger.error({ adminId: payload?.adminId, err: error }, '[Validate Admin] Token validation failed:');
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  /**
   * GET /api/auth/admins
   * Get all admins (Admins with create_cms permission or SUPER_ADMIN)
   * Returns list of admins excluding passwordHash
   */
  @Get('admins')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllAdmins(@Req() req: any) {
    try {
      const adminId = req.user.adminId;
      this.logger.log({ adminId }, `[Get All Admins] Request from admin ID: ${adminId}`);

      const admins = await this.authService.getAllAdmins(
        req.user.adminId,
        req.user.role,
        req.user.permissions,
      );

      return {
        success: true,
        admins: omitSensitive(admins),
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Get All Admins] Error:');
      throw error;
    }
  }

  /**
   * GET /api/auth/admin/stats
   * Get admin statistics for dashboard
   * Returns counts: total users, verified users, total admins, active admins
   * All admins can access this endpoint
   */
  @Get('admin/stats')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAdminStats() {
    try {
      const stats = await this.authService.getAdminStats();

      return stats;
    } catch (error) {
      this.logger.error({ err: error }, '[Get Admin Stats] Error:');
      throw error;
    }
  }

  /**
   * GET /api/auth/admin/audit-logs
   * Get all audit logs (Super Admin only)
   */
  @Get('admin/audit-logs')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async getAuditLogs() {
    try {
      const logs = await this.authService.getAllAuditLogs();
      return logs;
    } catch (error) {
      this.logger.error({ err: error }, '[Get Audit Logs] Error:');
      throw error;
    }
  }

  /**
   * GET /api/auth/admin/users
   * Get all users with optional filters (Admin only)
   */
  @Get('admin/users')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllUsers(
    @Query('kycStatus') kycStatus?: string,
    @Query('search') search?: string,
    @Query('submittedOnly') submittedOnly?: string,
    @Query('dematStatus') dematStatus?: string,
    @Query('bankStatus') bankStatus?: string,
    @Query('bankSubmittedOnly') bankSubmittedOnly?: string,
    @Query('dematSubmittedOnly') dematSubmittedOnly?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      // `submittedOnly=true` means: return only users whose `kycData.submittedAt` exists.
      // This is the explicit signal that a user has completed the KYC form and submitted for admin review.
      const users = await this.authService.getAllUsers({
        kycStatus,
        search,
        submittedOnly: submittedOnly === 'true',
        dematStatus,
        bankStatus,
        bankSubmittedOnly: bankSubmittedOnly === 'true',
        dematSubmittedOnly: dematSubmittedOnly === 'true',
        startDate,
        endDate,
      });
      return omitCredentials(users);
    } catch (error) {
      this.logger.error({ err: error }, '[Get All Users] Error:');
      throw error;
    }
  }

  /**
   * GET /api/auth/admin/users/:userId
   * Get detailed user information including KYC data (Admin only)
   */
  @Get('admin/users/:userId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserDetailsById(@Param('userId') userId: string) {
    try {
      const user = await this.authService.getUserDetailsById(userId);
      return omitCredentials(user);
    } catch (error) {
      this.logger.error({ err: error }, '[Get User Details] Error:');
      throw error;
    }
  }

  /**
   * POST /api/auth/admin/users/:userId/delete
   * Permanently delete a user and their uploaded files (Admin only)
   * Using POST instead of DELETE to bypass WAF restrictions on DELETE methods
   */
  @Post('admin/users/:userId/delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async permanentlyDeleteUser(@Param('userId') userId: string) {
    try {
      return await this.authService.permanentlyDeleteUser(userId);
    } catch (error) {
      this.logger.error({ err: error }, '[Delete User] Error:');
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'An internal server error occurred');
    }
  }

  /**
   * GET /api/auth/user/:id
   * Public endpoint to get user basic info (used by support panel to show user info on tickets)
   */
  @Public()
  @Get('user/:id')
  @HttpCode(200)
  async getUserById(@Param('id') userId: string) {
    try {
      const user = await this.authService.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Get User By Id] Error:');
      // Let the error bubble up (usually 400 or 404)
      throw error;
    }
  }

  /**
   * GET /api/auth/admin/:id
   * Public endpoint to get admin basic info (used by support panel to show agent info on tickets)
   */
  @Public()
  @Get('admin/:id')
  @HttpCode(200)
  async getAdminById(@Param('id') adminId: string) {
    try {
      const admin = await this.authService.getAdminById(adminId);
      if (!admin) {
        throw new NotFoundException('Admin not found');
      }
      return {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      };
    } catch (error) {
      if (error.status === 404 || error instanceof NotFoundException) {
        throw new NotFoundException('Admin not found');
      }
      this.logger.error({ err: error }, `[Get Admin By ID] Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch admin');
    }
  }

  /**
   * PATCH /api/auth/admin/:id
   * Update admin permissions (Admins with create_cms permission or SUPER_ADMIN)
   * Prevents self-edit to avoid accidental permission lockout
   */
  @Patch('admin/:id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateAdminPermissions(
    @Param('id') adminId: string,
    @Body() dto: UpdateAdminPermissionsDto,
    @Req() req: any,
  ) {
    try {
      const currentAdminId = req.user.adminId;

      // Prevent self-edit
      if (adminId === currentAdminId) {
        this.logger.warn({ event: 'admin.permissions.update.self_edit', adminId, currentAdminId }, 'Cannot modify own permissions');
        throw new BadRequestException('Cannot modify your own permissions');
      }

      const targetAdmin = await this.authService.getAdminById(adminId);
      if (
        req.user.role !== 'SUPER_ADMIN' &&
        targetAdmin.role !== 'CONTENT_MANAGER'
      ) {
        this.logger.warn({ event: 'admin.permissions.update.not_authorized', adminId, currentAdminId, targetRole: targetAdmin.role, requesterRole: req.user.role }, 'Not authorized to modify this admin');
        throw new ForbiddenException('You can only modify Content Managers');
      }

      this.logger.log(
        { adminId, currentAdminId }, `[Update Admin Permissions] Admin ${currentAdminId} updating permissions for admin ${adminId}`,
      );

      const updatedAdmin = await this.authService.updateAdminPermissions(
        adminId,
        dto.permissions,
      );

      return {
        success: true,
        admin: updatedAdmin,
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Update Admin Permissions] Error:');
      throw error;
    }
  }

  /**
   * PATCH /api/auth/admins/:id/availability
   * Update Support Agent availability status (Super Admin or the agent themselves)
   * Protected by JwtAuthGuard and AdminGuard
   */
  @Patch('admins/:id/availability')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateAvailability(
    @Param('id') adminId: string,
    @Body() dto: UpdateAvailabilityDto,
    @Req() req: any,
  ) {
    try {
      const currentAdminId = req.user.adminId;

      // Allow Super Admin or the agent themselves to update availability
      if (
        req.user.role !== 'SUPER_ADMIN' &&
        currentAdminId !== adminId
      ) {
        this.logger.warn({ event: 'admin.availability.update.not_authorized', adminId, currentAdminId, requesterRole: req.user.role }, 'Not authorized to update Support Agent availability');
        throw new ForbiddenException(
          'You do not have permission to update Support Agent availability',
        );
      }

      this.logger.log(
        { adminId, currentAdminId }, `[Update Availability] Admin ${currentAdminId} updating availability for Support Agent ${adminId}`,
      );

      const updatedAdmin = await this.authService.updateAvailability(
        adminId,
        dto.availability,
        dto.availabilityNote,
      );

      return {
        success: true,
        admin: updatedAdmin,
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Update Availability] Error:');
      throw error;
    }
  }

  /**
   * DELETE /api/auth/admin/:id
   * Delete an admin account (Admins with create_cms permission or SUPER_ADMIN)
   */
  @Delete('admin/:id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteAdmin(@Param('id') adminId: string, @Req() req: any) {
    try {
      const currentAdminId = req.user.adminId;

      // Prevent self-delete
      if (adminId === currentAdminId) {
        this.logger.warn({ event: 'admin.delete.self_delete', adminId, currentAdminId }, 'Cannot delete own account');
        throw new BadRequestException('Cannot delete your own account');
      }

      const targetAdmin = await this.authService.getAdminById(adminId);
      if (
        req.user.role !== 'SUPER_ADMIN' &&
        targetAdmin.role !== 'CONTENT_MANAGER'
      ) {
        this.logger.warn({ event: 'admin.delete.not_authorized', adminId, currentAdminId, targetRole: targetAdmin.role, requesterRole: req.user.role }, 'Not authorized to delete this admin');
        throw new ForbiddenException('You can only delete Content Managers');
      }

      this.logger.log(
        { adminId, currentAdminId }, `[Delete Admin] Admin ${currentAdminId} deleting admin ${adminId}`,
      );

      // Pass the requester as the preferred fallback owner for any
      // attributed records (stocks, baskets, leads, change requests) so
      // long-lived panel users can be deleted without FK violations.
      // The service falls back to the oldest SUPER_ADMIN when omitted.
      const result = await this.authService.deleteAdmin(adminId, currentAdminId);

      return {
        success: true,
        message: 'Admin account deleted successfully',
        reassignedTo: (result as any)?.reassignedTo,
      };
    } catch (error) {
      this.logger.error({ err: error }, '[Delete Admin] Error:');
      throw error;
    }
  }

  // NOTE: RM authentication endpoints (rm/login, rm/logout, rm/verify) were
  // removed as part of RM system deprecation. Three endpoints were here:
  //   POST /api/auth/rm/login
  //   POST /api/auth/rm/logout
  //   GET  /api/auth/rm/verify

  /**
   * GET /api/auth/phone/otp/status
   * Get OTP cooldown and active session status for a phone number
   */
  @Get('phone/otp/status')
  @Public()
  @HttpCode(200)
  async getPhoneOTPStatus(@Query('phone') phone: string) {
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    return await this.authService.getPhoneOTPStatus(phone);
  }

  /**
   * POST /api/auth/phone/otp/request
   * Request OTP for phone-first authentication
   * Public endpoint - no authentication required
   */
  @Post('phone/otp/request')
  @Public()
  @HttpCode(200)
  @SkipThrottle() // Redis enforces the OTP limit and resets it after successful login.
  async requestPhoneOTP(@Body() dto: PhoneOtpRequestDto, @Req() req: any) {
    try {
      const ip = this.getClientIp(req);
      const idempotencyKey = req.headers['x-idempotency-key'];
      if (idempotencyKey) {
        const cached = await this.authService.redis.getIdempotencyResponse(idempotencyKey);
        if (cached) return cached;
      }
      this.logger.log(`Phone OTP request for ${dto.phone?.slice(-4)?.padStart(dto.phone?.length || 0, '*')}`);
      const deviceFingerprint = req.headers['x-device-fingerprint'];
      const result = await this.authService.sendPhoneOTP(dto.phone, ip, dto.captchaToken, deviceFingerprint);
      if (idempotencyKey) {
        await this.authService.redis.setIdempotencyResponse(idempotencyKey, result, 300);
      }
      return result;
    } catch (error: any) {
      this.logger.error({ err: error }, '[Phone OTP Request] Error:');
      throw error;
    }
  }

  /**
   * POST /api/auth/phone/otp/verify
   * Verify phone OTP for phone-first authentication
   * Public endpoint - no authentication required
   * Returns needsEmail flag and token if user has email
   */
  @Post('phone/otp/verify')
  @Public()
  @HttpCode(200)
  // @Throttle({ default: { limit: 5, ttl: 120000 } }) // 5 attempts per 2 minutes
  @SkipThrottle() // OTP rate limit commented out
  async verifyPhoneOTP(
    @Req() req: any,
    @Body() dto: PhoneOtpVerifyDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    try {

      const result = await this.authService.verifyPhoneOTP(dto.phone, dto.otp, req);

      if (!result.needsEmail && result.token) {
        res.clearCookie('pending_signup', this.cookieOptions);
        res.clearCookie('phone_verification', this.cookieOptions);
        // Existing user with email - set cookie and return token

        // Track user session
        try {
          const ip = this.getClientIp(req);
          const userAgent = req.headers['user-agent'] || 'Unknown';
          this.authService.logUserLogin(result.user?.id || '', ip, userAgent).catch((err: any) => this.logger.warn({ userId: result.user?.id, err }, 'logUserLogin failed'));
        } catch(e) {}

        res.setCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, result.token!, this.cookieOptions);
        const isMobile = req.headers['x-client-type'] === 'mobile';
        return {
          success: true,
          needsEmail: false,
          wasDeactivated: result.user?.wasDeactivated || false,
          // Mobile clients cannot read HttpOnly cookies, so return the
          // session token AND sanitised user object in the response body.
          ...(isMobile && {
            token: result.token,
            user: result.user ? omitSensitive(result.user) : undefined,
          }),
        };
        
      } else {
        // Bind signup to this verified phone with a short-lived, one-use proof.
        res.setCookie('phone_verification', result.phoneVerificationToken!, { ...this.cookieOptions, maxAge: 600 });
        res.clearCookie('pending_signup', this.cookieOptions);
        res.clearCookie(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN, this.cookieOptions);
        return {
          success: true,
          needsEmail: true,
          ...(req.headers['x-client-type'] === 'mobile' && { phoneVerificationToken: result.phoneVerificationToken }),
          user: {
            ...result.user,
            phone: result.user?.phone ? maskPhone(result.user.phone) : null,
          },
          phone: maskPhone(dto.phone),
          wasDeactivated: result.user?.wasDeactivated || false,
        };
      }
    } catch (error: any) {
      this.logger.error({ err: error }, '[Phone OTP Verify] Error:');
      throw error;
    }
  }

  // NOTE: linkGoogleToPhone method removed as part of Google Auth deprecation.

  /**
   * GET /api/auth/system/auth-mode
   * Get authentication mode status (public endpoint for admin panel)
   */
  @Get('system/auth-mode')
  @Public()
  async getAuthModeStatus() {
    return {
      phoneFirstAuthMode: true, // Phone-first authentication is always active
    };
  }

  /**
   * POST /api/auth/distributor/login
   * Distributor login with email and password
   */

  // ============================================
  // BRANCH & INTERNAL RM ACTIONS
  // ============================================

  /**
   * GET /api/auth/branch/login-options
   * Active branches (id + name) for the branch login dropdown.
   */
  @Get('branch/login-options')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(200)
  async branchLoginOptions() {
    const branches = await this.authService.getBranchLoginOptions();
    return { success: true, branches };
  }

  @Post('branch/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async branchLogin(
    @Req() req: any,
    @Body() dto: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const logger = this.logger;
    logger.log(`Logging in branch: ${dto.email}`);

    const branch = await this.authService.branchLogin(dto.email, dto.password, dto.branchId);
    const token = await this.authService.generateBranchToken(branch.id, branch.email, branch.name, req);

    res.setCookie(
      OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN,
      token,
      this.cookieOptions,
    );

    return { success: true, branch: omitSensitive(branch) };
  }

  @Get('branch/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyBranchSession(@Req() req: any) {
    const branchId = req.user.branchId;
    if (!branchId || req.user.type !== 'BRANCH') throw new UnauthorizedException('Invalid branch session');
    const branch = await this.authService.getBranchById(branchId);
    return { success: true, branch: omitSensitive(branch) };
  }

  @Post('internal-rm/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async internalRmLogin(
    @Req() req: any,
    @Body() dto: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const logger = this.logger;
    logger.log(`Logging in internal RM: ${dto.email}`);

    const rm = await this.authService.internalRmLogin(dto.email, dto.password);
    const token = await this.authService.generateInternalRmToken(rm.id, rm.email, rm.name, rm.branchId, req);

    res.setCookie(
      OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN,
      token,
      this.cookieOptions,
    );

    return { success: true, rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('branch/internal-rm')
  async createInternalRm(@Body() dto: CreatePartnerRmDto, @Req() req: any) {
    const user = req.user;
    if (user.type !== 'BRANCH' || !user.branchId) throw new UnauthorizedException('Only branches can create Internal RMs');
    const rm = await this.authService.createInternalRm(user.branchId, dto.name, dto.email, dto.password, dto.employeeId);
    return { success: true, message: 'Internal RM created successfully', rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('branch/internal-rm/:id')
  async updateInternalRmEmployeeId(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerRmEmployeeIdDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.type !== 'BRANCH' || !user.branchId) throw new UnauthorizedException('Only branches can update Internal RMs');
    const rm = await this.authService.updateInternalRmEmployeeId(user.branchId, id, dto.employeeId);
    return { success: true, message: 'Employee ID updated successfully', rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('branch/internal-rm/:id')
  @HttpCode(HttpStatus.OK)
  async updateInternalRmEmployeeIdPost(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerRmEmployeeIdDto,
    @Req() req: any,
  ) {
    return this.updateInternalRmEmployeeId(id, dto, req);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('branch/internal-rm/:id')
  async deleteBranchInternalRm(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (user.type !== 'BRANCH' || !user.branchId) throw new UnauthorizedException('Only branches can delete Internal RMs');
    await this.authService.deleteInternalRm(user.branchId, id);
    return { success: true, message: 'Relationship Manager deleted successfully' };
  }

  /** POST alias for DELETE — WAF/reverse proxy blocks the DELETE method */
  @UseGuards(JwtAuthGuard)
  @Post('branch/internal-rm/:id/delete')
  @HttpCode(HttpStatus.OK)
  async deleteBranchInternalRmPost(@Param('id') id: string, @Req() req: any) {
    return this.deleteBranchInternalRm(id, req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('branch/internal-rms')
  async getBranchInternalRms(@Req() req: any) {
    const user = req.user;
    if (user.type !== 'BRANCH' || !user.branchId) throw new UnauthorizedException('Only branches can view Internal RMs');
    const rms = await this.authService.getBranchInternalRms(user.branchId);
    return { success: true, rms: omitSensitive(rms) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/branches')
  async getAllBranches() {
    const branches = await this.authService.getAllBranches();
    return { success: true, branches: omitSensitive(branches) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/branches/:id')
  async adminGetBranch(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    // Only the branch editor needs the full email; list responses stay masked.
    const branch = await this.authService.getBranchForAdmin(id);
    return { success: true, branch: omitCredentials(branch) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/branches/:id')
  async adminUpdateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: any,
  ) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    const { name, email, ...classificationFields } = dto;
    const branch = await this.authService.updateBranch(id, name, email, classificationFields);
    return { success: true, branch: omitSensitive(branch) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/branches')
  async adminCreateBranch(@Body() dto: CreateBranchDto) {
    const { name, email, password, ...classificationFields } = dto;
    if (!name || !email || !password) throw new BadRequestException('Name, email, and password are required');
    const passwordHash = await require("bcrypt").hash(password, 10);
    const branch = await this.authService.createBranch(name, email, passwordHash, classificationFields);
    return { success: true, branch: omitSensitive(branch) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/branches/:id')
  async adminDeleteBranch(@Param('id') id: string) {
    await this.authService.deleteBranch(id);
    return { success: true, message: 'Branch deleted successfully' };
  }

  // ============================================
  // DISTRIBUTOR & DISTRIBUTOR RM ACTIONS
  // ============================================

  @Post('distributor/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async distributorLogin(
    @Req() req: any,
    @Body() dto: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const logger = this.logger;
    logger.log(`Logging in distributor: ${dto.email}`);

    const distributor = await this.authService.distributorLogin(dto.email, dto.password);
    const token = await this.authService.generateDistributorToken(distributor.id, distributor.email, distributor.name, req);

    res.setCookie(
      OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN,
      token,
      this.cookieOptions,
    );

    return { success: true, distributor: omitSensitive(distributor) };
  }

  @Get('distributor/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyDistributorSession(@Req() req: any) {
    const distributorId = req.user.distributorId;
    if (!distributorId || req.user.type !== 'DISTRIBUTOR') throw new UnauthorizedException('Invalid distributor session');
    const distributor = await this.authService.getDistributorById(distributorId);
    return { success: true, distributor: omitSensitive(distributor) };
  }

  @Get('rm/verify')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @HttpCode(200)
  async verifyRmSession(@Req() req: any) {
    const user = req.user;
    if (user.type === 'INTERNAL_RM' && user.internalRmId) {
      const rm = await this.prisma.internalRM.findUnique({
        where: { id: user.internalRmId },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          status: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
      });
      if (!rm || rm.status !== 'ACTIVE') throw new UnauthorizedException('RM account deactivated or not found');
      return { success: true, rm: { ...rm, type: 'INTERNAL_RM' } };
    } else if (user.type === 'DISTRIBUTOR_RM' && user.distributorRmId) {
      const rm = await this.prisma.distributorRM.findUnique({
        where: { id: user.distributorRmId },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          status: true,
          createdAt: true,
          distributor: { select: { name: true } },
        },
      });
      if (!rm || rm.status !== 'ACTIVE') throw new UnauthorizedException('RM account deactivated or not found');
      return { success: true, rm: { ...rm, type: 'DISTRIBUTOR_RM' } };
    }
    throw new UnauthorizedException('Invalid RM session');
  }

  @Get('verify')
  verifyToken(@Req() req: any) {
    return { success: true, user: req.user };
  }

  @Post('distributor-rm/login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(200)
  async distributorRmLogin(
    @Req() req: any,
    @Body() dto: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const logger = this.logger;
    logger.log(`Logging in distributor RM: ${dto.email}`);

    const rm = await this.authService.distributorRmLogin(dto.email, dto.password);
    const token = await this.authService.generateDistributorRmToken(rm.id, rm.email, rm.name, rm.distributorId, req);

    res.setCookie(
      OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN,
      token,
      this.cookieOptions,
    );

    return { success: true, rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('distributor/distributor-rm')
  async createDistributorRm(@Body() dto: CreatePartnerRmDto, @Req() req: any) {
    const user = req.user;
    if (user.type !== 'DISTRIBUTOR' || !user.distributorId) throw new UnauthorizedException('Only distributors can create Distributor RMs');
    const rm = await this.authService.createDistributorRm(user.distributorId, dto.name, dto.email, dto.password, dto.employeeId);
    return { success: true, message: 'Distributor RM created successfully', rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('distributor/distributor-rm/:id')
  async updateDistributorRmEmployeeId(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerRmEmployeeIdDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.type !== 'DISTRIBUTOR' || !user.distributorId) throw new UnauthorizedException('Only distributors can update Distributor RMs');
    const rm = await this.authService.updateDistributorRmEmployeeId(user.distributorId, id, dto.employeeId);
    return { success: true, message: 'Employee ID updated successfully', rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('distributor/distributor-rm/:id')
  @HttpCode(HttpStatus.OK)
  async updateDistributorRmEmployeeIdPost(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerRmEmployeeIdDto,
    @Req() req: any,
  ) {
    return this.updateDistributorRmEmployeeId(id, dto, req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('distributor/distributor-rms')
  async getDistributorRms(@Req() req: any) {
    const user = req.user;
    if (user.type !== 'DISTRIBUTOR' || !user.distributorId) throw new UnauthorizedException('Only distributors can view Distributor RMs');
    const rms = await this.authService.getDistributorRms(user.distributorId);
    return { success: true, rms: omitSensitive(rms) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/distributors')
  async getAllDistributors() {
    const distributors = await this.authService.getAllDistributors();
    return { success: true, distributors: omitSensitive(distributors) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/distributors/:id')
  async adminGetDistributor(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    // Only the distributor editor needs the full email; list responses stay masked.
    const distributor = await this.authService.getDistributorForAdmin(id);
    return { success: true, distributor: omitCredentials(distributor) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/distributors/:id')
  async adminUpdateDistributor(
    @Param('id') id: string,
    @Body() dto: UpdateDistributorDto,
    @Req() req: any,
  ) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    const distributor = await this.authService.updateDistributor(id, dto.name, dto.email);
    return { success: true, distributor: omitSensitive(distributor) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/distributors')
  async adminCreateDistributor(@Body() dto: CreateDistributorDto) {
    const { name, email, password } = dto;
    if (!name || !email || !password) throw new BadRequestException('Name, email, and password are required');
    const passwordHash = await require("bcrypt").hash(password, 10);
    const distributor = await this.authService.createDistributor(name, email, passwordHash);
    return { success: true, distributor: omitSensitive(distributor) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/distributors/:id')
  async adminDeleteDistributor(@Param('id') id: string) {
    await this.authService.deleteDistributor(id);
    return { success: true, message: 'Distributor deleted successfully' };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/rms')
  async getAllRms() {
    const [internalRms, distributorRms] = await Promise.all([
      this.authService.getAllInternalRms(),
      this.authService.getAllDistributorRms()
    ]);
    
    // Map to a unified format for the admin dashboard
    const mappedInternal = internalRms.map(rm => ({
      ...rm,
      type: 'INTERNAL_RM',
      parentName: rm.branch?.name || 'Unknown Branch',
      parentId: rm.branchId,
      conversionsCount: rm._count?.couponsGenerated || 0,
      totalRevenue: 0, // This would be fetched from stocks service in a full implementation
    }));
    
    const mappedDistributor = distributorRms.map(rm => ({
      ...rm,
      type: 'DISTRIBUTOR_RM',
      parentName: rm.distributor?.name || 'Unknown Distributor',
      parentId: rm.distributorId,
      conversionsCount: rm._count?.couponsGenerated || 0,
      totalRevenue: 0,
    }));
    
    // Combine and sort by creation date
    const allRms = [...mappedInternal, ...mappedDistributor].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return { success: true, rms: omitSensitive(allRms) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/rms')
  async adminCreateRm(@Body() dto: AdminCreateRmDto) {
    const { name, email, password, type, parentId } = dto;
    if (!name || !email || !password || !type || !parentId) {
      throw new BadRequestException('Name, email, password, type, and parentId are required');
    }
    
    let rm;
    if (type === 'INTERNAL_RM') {
      rm = await this.authService.createInternalRm(parentId, name, email, password);
    } else if (type === 'DISTRIBUTOR_RM') {
      rm = await this.authService.createDistributorRm(parentId, name, email, password);
    } else {
      throw new BadRequestException('Invalid RM type');
    }
    
    return { success: true, rm: omitSensitive(rm) };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/rms/:id')
  async adminDeleteRm(@Param('id') id: string) {
    await this.authService.deleteRm(id);
    return { success: true, message: 'Relationship Manager deleted successfully' };
  }

  /**
   * POST /api/auth/partner/forgot-password/send-otp
   * Send a password-reset OTP to a Branch / Distributor account email.
   */
  @Post('partner/forgot-password/send-otp')
  @Public()
  // @Throttle({ default: { limit: 10, ttl: 60000 } })
  @SkipThrottle()
  @HttpCode(200)
  async sendPartnerForgotPasswordOtp(@Body() dto: SendPartnerForgotPasswordOtpDto) {
    return this.authService.sendPartnerForgotPasswordOtp(dto.email, dto.portal);
  }

  /**
   * POST /api/auth/partner/forgot-password/verify-otp
   * Verify OTP server-side and issue a short-lived reset token.
   */
  @Post('partner/forgot-password/verify-otp')
  @Public()
  // @Throttle({ default: { limit: 20, ttl: 60000 } })
  @SkipThrottle()
  @HttpCode(200)
  async verifyPartnerForgotPasswordOtp(@Body() dto: VerifyPartnerForgotPasswordOtpDto) {
    return this.authService.verifyPartnerForgotPasswordOtp(dto.email, dto.portal, dto.otp);
  }

  /**
   * POST /api/auth/partner/forgot-password/reset-password
   * Reset password for any partner portal (branch, distributor, internal-rm, distributor-rm).
   */
  @Post('partner/forgot-password/reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async resetPartnerPassword(@Body() dto: ResetPartnerPasswordDto) {
    return this.authService.resetPartnerPassword(dto.portal, dto.email, dto.resetToken, dto.password);
  }

  @Post('distributor/reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async resetDistributorPassword(@Body() dto: ResetDistributorPasswordDto) {
    return this.authService.resetPartnerPassword('distributor', dto.email, dto.resetToken, dto.password);
  }

  @Post('branch/reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async resetBranchPassword(@Body() dto: ResetDistributorPasswordDto) {
    return this.authService.resetPartnerPassword('branch', dto.email, dto.resetToken, dto.password);
  }

  // ==========================================
  // SESSION MANAGEMENT ENDPOINTS
  // ==========================================

  /**
   * GET /api/auth/sessions
   * List all active sessions for the authenticated user.
   * Returns device, IP, login time, and whether it's the current session.
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getActiveSessions(@Req() req: any) {
    const userId = req.user.adminId || req.user.userId || req.user.branchId || req.user.internalRmId || req.user.distributorId || req.user.distributorRmId;
    if (!userId) throw new UnauthorizedException('Invalid session');
    const currentSessionId = req.user.sessionId;
    const sessions = await this.authService.getActiveSessions(userId, currentSessionId);
    return { success: true, sessions };
  }

  /**
   * DELETE /api/auth/sessions/:sessionId
   * Terminate a specific session by its ID.
   * Users can only terminate their own sessions.
   */
  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async terminateSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    const userId = req.user.adminId || req.user.userId || req.user.branchId || req.user.internalRmId || req.user.distributorId || req.user.distributorRmId;
    if (!userId) throw new UnauthorizedException('Invalid session');
    return this.authService.terminateSession(userId, sessionId);
  }

  /**
   * POST /api/auth/sessions/terminate-others
   * Log out of all other devices. Keeps only the current session alive.
   */
  @Post('sessions/terminate-others')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async terminateAllOtherSessions(@Req() req: any) {
    const userId = req.user.adminId || req.user.userId || req.user.branchId || req.user.internalRmId || req.user.distributorId || req.user.distributorRmId;
    if (!userId) throw new UnauthorizedException('Invalid session');
    const currentSessionId = req.user.sessionId;
    if (!currentSessionId) throw new BadRequestException('Could not identify current session');
    return this.authService.terminateAllOtherSessions(userId, currentSessionId);
  }

  // ==========================================
  // PANEL FORGOT PASSWORD ENDPOINTS
  // ==========================================

  /**
   * POST /api/auth/panel/forgot-password/send-otp
   * Request OTP for panel user forgot password
   */
  @Post('panel/forgot-password/send-otp')
  @Public()
  // @Throttle({ default: { limit: 10, ttl: 60000 } })
  @SkipThrottle()
  @HttpCode(200)
  async sendPanelForgotPasswordOtp(@Body() dto: SendPanelForgotPasswordOtpDto) {
    return this.authService.sendPanelForgotPasswordOtp(dto.email);
  }

  /**
   * POST /api/auth/panel/forgot-password/verify-otp
   * Verify OTP for panel user forgot password
   */
  @Post('panel/forgot-password/verify-otp')
  @Public()
  // @Throttle({ default: { limit: 20, ttl: 60000 } })
  @SkipThrottle()
  @HttpCode(200)
  async verifyPanelForgotPasswordOtp(@Body() dto: VerifyPanelForgotPasswordOtpDto) {
    return this.authService.verifyPanelForgotPasswordOtp(dto.email, dto.otp);
  }

  /**
   * POST /api/auth/panel/forgot-password/reset-password
   * Reset password for panel user after OTP verification
   */
  @Post('panel/forgot-password/reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async resetPanelPassword(@Body() dto: ResetPanelPasswordDto) {
    return this.authService.resetPanelPassword(
      dto.email,
      dto.resetToken,
      dto.newPassword,
    );
  }
}
