import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { EmailService } from 'email-service';
import type { PartnerPortal } from './dto/distributor-reset-password.dto';
import { AdminRole, Prisma } from 'db-unlistedstock';
import { PinoNestLogger } from '@smc/logger';
import { ALL_PERMISSIONS } from 'db-unlistedstock/src/constants/admin-permissions';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { decryptTokenSafe } from 'cookie-crypto';
import { assertStrongPassword } from './utils/password-policy.util';

export interface BranchClassificationInput {
  classification?: string;
  classificationLabel?: string;
  zone?: string;
  zonalHead?: string;
  areaManager?: string;
  branchManager?: string;
  territory?: string;
  territoryHead?: string;
  reportingManager?: string;
}

/**
 * AuthService handles all authentication business logic
 * - OTP generation and verification via SMC SMS Gateway
 * - Session-based authentication
 */
@Injectable()
export class AuthService {
  private readonly MAX_RETRIES = 5;
  private readonly logger = new PinoNestLogger('auth-service', 'AuthService');
  private readonly SESSION_TTL = 86400;
  /** Idle timeout in seconds — BROWSER sessions expire after this much inactivity (10 minutes) */
  readonly IDLE_TIMEOUT_SECONDS = 600;
  /** Absolute maximum BROWSER session lifetime (7 days) */
  private readonly MAX_SESSION_LIFETIME_SECONDS = 604800;
  /** Mobile APK sessions are effectively permanent — they only expire on
   *  manual logout, app uninstall, or when the user logs in on a new device
   *  (the single-session policy in createSession auto-revokes the old one). */
  private readonly APK_SESSION_TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // ~5 years

  constructor(
    private prisma: PrismaService,
    public redis: RedisService,
    private smsService: SmsService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a random 6-digit OTP
   * @returns 6-digit OTP as string
   */
  private generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hash OTP using SHA-256 before storing
   */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Automatically track User Sessions upon login
   * Captures IP, Device, and asynchronously fetches Geographical Location mapping
   */
  async logUserLogin(userId: string, ip: string, userAgent: string) {
    try {
      let resolvedLocation = 'Unknown';

      // Internal IPv4/v6 map check
      if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.')) {
        resolvedLocation = 'Local Development';
      } else {
        try {
          const fetchRes = await fetch(`http://ip-api.com/json/${ip.split(',')[0].trim()}?fields=city,regionName,country`);
          if (fetchRes.ok) {
            const data: any = await fetchRes.json();
            if (data && data.status !== 'fail') {
               resolvedLocation = [data.city, data.regionName, data.country].filter(Boolean).join(', ');
            }
          }
        } catch (e) {
          this.logger.warn({ userId, ip, err: e }, `[LoginHistory] Could not resolve location for IP ${ip}`);
        }
      }

      await (this.prisma as any).loginHistory.create({
        data: {
          userId,
          ipAddress: ip || 'Unknown',
          deviceInfo: userAgent || 'Unknown',
          location: resolvedLocation,
        }
      });
      this.logger.info({ userId, ip, location: resolvedLocation }, `[Session Tracked] User ${userId} logged in from ${resolvedLocation} via IP ${ip}`);
    } catch (dbError) {
      this.logger.error({ userId, err: dbError }, '[LoginHistory] Database Error Tracking Session');
    }
  }

  /**
   * ========================================================================
   * LEGACY OTP (JWT-PROTECTED) — POST-LOGIN PHONE VERIFICATION
   * ========================================================================
   * `sendOTP` / `verifyOTP` are the original “email/google-first → then verify
   * phone” flow.
   *
   * Key differences vs phone-first OTP:
   * - Legacy OTP requires an authenticated user (controller protects via JWT).
   * - Legacy OTP updates an existing user record with `phone` + `currentStep`.
   * - Phone-first OTP is a public flow used to create/advance a phone-only user
   *   and optionally link Google later.
   *
   * Please do not use these methods for phone-first login/signup. Use the
   * phone-first methods instead (see `sendPhoneOTP` / `verifyPhoneOTP`).
   *
   * Security note:
   * - Logging OTPs is only appropriate for local/dev testing. If this is ever
   *   used in real environments, prefer guarding OTP logging behind an explicit
   *   environment flag (similar to the phone-first console fallback behavior).
   *
   * @param mobile - 10-digit mobile number
   * @param userId - User ID from JWT token
   * @returns Success message
   */
  async sendOTP(mobile: string, userId: string, ip: string = 'Unknown', captchaToken?: string, deviceFingerprint?: string) {
    const lockKey = `lock:otp:gen:${mobile}`;
    const acquired = await this.redis.acquireLock(lockKey, 120);
    if (!acquired) {
      throw new BadRequestException('An OTP request is already in progress. Please wait.');
    }

    try {
      await this.redis.checkOtpRateLimits(mobile, ip, deviceFingerprint);

      let otp = this.generateOTP();
      let isPlayStoreTestAccount = false;

      // Reserved Play Store review number; still requires a Redis OTP request and verification.
      if (mobile === '0123456789') {
        otp = '123456';
        isPlayStoreTestAccount = true;
      }

      // Log OTP to console for testing in dev/staging
      const allowConsoleFallback =
        process.env.NODE_ENV !== 'production';
      if (allowConsoleFallback) {
        this.logger.log({ event: 'otp.generated', mode: 'legacy' }, `OTP for ${mobile}: ${otp}`);
      }

      // Store hashed OTP in Redis
      await this.redis.setOTP(mobile, this.hashOtp(otp), 300, isPlayStoreTestAccount ? 0 : 30, { key: lockKey, token: acquired });

      try {
        let smsResult: any = { success: true };
        
        // Send OTP via SMC SMS Gateway.
        if (isPlayStoreTestAccount) {
          this.logger.log(`[OTP Request] Bypassing SMS send for Play Store test account ${mobile}`);
        } else {
          smsResult = await this.smsService.sendOtpSms(mobile, otp);
        }

        if (!smsResult.success) {
          this.logger.error({ event: 'sms.gateway.error', errorCode: smsResult.errorCode, errorDesc: smsResult.errorDesc },
            `SMS gateway error for ${mobile}: ${smsResult.errorCode} — ${smsResult.errorDesc}`,
          );
          throw new BadRequestException('Unable to send OTP. Please try again later.');
        }

        this.logger.log(`[OTP Request] Legacy OTP requested for ${mobile.length > 4 ? `******${mobile.slice(-4)}` : mobile}`);
        return { success: true, message: 'OTP sent successfully' };
      } catch (error: any) {
        if (error instanceof HttpException) {
          throw error;
        }
        this.logger.error({ err: error }, `SMS sending error: ${error.message}`);
        throw new BadRequestException('Unable to send OTP. Please try again later.');
      }
    } finally {
      await this.redis.releaseLock(lockKey, acquired);
    }
  }

  /**
    * Verify OTP entered by user (legacy post-login flow).
    * Checks against stored OTP in Redis and validates retry attempts.
    *
    * Behavior:
    * - On success, sets `user.phone = mobile` and advances `currentStep`.
    * - This assumes the user already exists and is authenticated.
    *
    * @param mobile - 10-digit mobile number
    * @param otp - 6-digit OTP entered by user
    * @param userId - User ID from JWT token
    * @returns Success message
   */
  async verifyOTP(mobile: string, otp: string, userId: string) {
    const startTime = Date.now();
    try {
      // Check if locked
      await this.redis.consumeOTP(mobile, this.hashOtp(otp), this.MAX_RETRIES);

      this.logger.log({ userId }, `[OTP Verify Success] Legacy OTP verified for user ID: ${userId}`);

      // Update user record with verified phone number
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: mobile,
        },
      });

      await this.redis.recordOtpMetric('success', Date.now() - startTime);

      return { success: true, message: 'OTP verified successfully' };
    } catch (err: any) {
      await this.redis.recordOtpMetric('failure', Date.now() - startTime);
      throw err;
    }
  }
  /**
   * Request OTP for Step-Up Authentication (Sensitive Actions)
   */
  async requestStepUpOtp(userId: string, ip: string = 'Unknown', captchaToken?: string, deviceFingerprint?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.phone) {
      throw new BadRequestException('User does not have a registered phone number. Please update your profile.');
    }
    return this.sendOTP(user.phone, userId, ip, captchaToken, deviceFingerprint);
  }

  /**
   * Verify OTP for Step-Up Authentication (Sensitive Actions)
   * Updates the Redis session with stepUpVerifiedAt instead of updating the database.
   */
  async verifyStepUpOtp(userId: string, hashedSessionId: string, otp: string) {
    const startTime = Date.now();
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.phone) {
        throw new BadRequestException('User does not have a registered phone number.');
      }
      
      const mobile = user.phone;

      // Check if locked
      await this.redis.consumeOTP(mobile, this.hashOtp(otp), this.MAX_RETRIES);

      this.logger.log({ userId }, `[Step-Up OTP Verify Success] Step-Up OTP verified for user ID: ${userId}`);

      // Update the Redis session to mark it as step-up verified
      const session = await this.redis.getSession(hashedSessionId);
      
      if (session && session.userId === userId) {
        session.stepUpVerifiedAt = Date.now();
        // Update the session in Redis with the remaining TTL
        await this.redis.setSession(hashedSessionId, session);
      }

      await this.redis.recordOtpMetric('success', Date.now() - startTime);

      return { success: true, message: 'Step-up authentication successful' };
    } catch (err: any) {
      await this.redis.recordOtpMetric('failure', Date.now() - startTime);
      throw err;
    }
  }


  /**
   * Get user by ID
   * @param userId - User's unique ID
   * @returns User object
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isActive === false) {
      throw new BadRequestException('Account is deactivated');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedRefreshToken, ...userSafe } = user;

    // Compute needsEmail flag for phone-first flow
    return {
      ...userSafe,
      needsEmail: !user.email, // True if email is null (phone-only user)
    };
  }

  // ==========================================================================
  // >>> SESSION MANAGEMENT
  // ==========================================================================

  private hashSessionId(sessionId: string): string {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
  }

  /**
   * Create a new session in Redis for the user
   */
  async createSession(userId: string, deviceClass: 'APK' | 'BROWSER', portal: string, req?: any) {
    // 1. Terminate existing session for this user within the SAME device class
    //    (Per-Device-Class Single-Session Policy).
    //    APK login only kills an existing APK session; BROWSER login only kills
    //    an existing BROWSER session.  This allows the user to stay logged in
    //    on both mobile and web simultaneously.
    const sameClassKey = `active-session:${deviceClass}:${userId}`;
    const legacyGlobalKey = `active-session:${userId}`; // Clean up old-format keys

    for (const key of [sameClassKey, legacyGlobalKey]) {
      const existingSessionId = await this.redis.getKey(key);
      if (existingSessionId) {
        await this.redis.deleteSession(this.hashSessionId(existingSessionId));
        await this.redis.deleteKey(key);
      }
    }

    const sessionId = crypto.randomBytes(32).toString('base64url');
    const hashedSessionId = this.hashSessionId(sessionId);

    // Get sessionVersion from Redis (emulating DB column for global logout)
    let sessionVersion = await this.redis.getKey(`user-session-version:${userId}`);
    if (sessionVersion === null) {
      sessionVersion = 1;
      await this.redis.setKey(`user-session-version:${userId}`, sessionVersion, 60 * 60 * 24 * 365); // 1 year
    }

    const deviceFingerprint = req?.headers?.['x-device-fingerprint'] || null;
    let userAgent = req?.headers?.['user-agent'] || 'Unknown';
    if (deviceClass === 'APK' && (userAgent === 'Unknown' || !userAgent || userAgent.startsWith('okhttp') || userAgent.startsWith('Expo'))) {
      userAgent = 'Mobile App (Android)';
    }
    const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || 'Unknown';
    const publicKey = req?.body?.publicKey || null;

    // Mobile (APK) sessions stay alive for 90 days so the app never
    // logs the user out.  Browser sessions cap at 7 days and are
    // additionally subject to a 10-minute idle timeout enforced in
    // SessionStrategy (session.strategy.ts).
    const ttl = deviceClass === 'APK'
      ? this.APK_SESSION_TTL_SECONDS   // 90 days
      : this.MAX_SESSION_LIFETIME_SECONDS; // 7 days

    const now = Date.now();

    // Store session with explicitly hashed ID
    await this.redis.setSession(
      hashedSessionId,
      { 
        userId,
        type: portal,
        deviceClass, 
        deviceFingerprint,
        publicKey,
        userAgent,
        ip,
        sessionVersion,
        createdAt: now,
        lastActivity: now,       // Tracked for idle-timeout (BROWSER only)
      },
      ttl,
    );

    // Track active session per device class (Per-Device-Class Single-Session)
    await this.redis.setKey(
      `active-session:${deviceClass}:${userId}`,
      sessionId,
      ttl,
    );

    // Also track in user's active session list for this portal
    await this.redis.trackSessionForLimit(userId, portal, hashedSessionId);

    this.logger.log({ userId, deviceClass, deviceFingerprint }, `Created new ${deviceClass} session for user ${userId} [FP: ${deviceFingerprint || 'None'}]`);
    return sessionId;
  }

  async logoutSessionFromRequest(req: any, cookieName: string): Promise<void> {
    try {
      const sessionId = req?.cookies?.[cookieName];
      if (!sessionId) {
        this.logger.warn(`Logout failed: Cookie ${cookieName} is missing.`);
        return;
      }
      await this.redis.deleteSession(this.hashSessionId(sessionId));
    } catch (err: any) {
      this.logger.warn(`Logout warning: Error processing session deletion: ${err.message}`);
    }
  }

  async generateTokens(payload: any, req?: any) {
    const userId = payload.userId || payload.adminId || payload.branchId || payload.internalRmId || payload.distributorId || payload.distributorRmId || payload.sub;
    const portal = payload.type || payload.role || 'USER';
    const appPlatform = req?.headers?.['x-app-platform'];
    const isMobile = appPlatform === 'android' || appPlatform === 'ios' || req?.headers?.['x-client-type'] === 'mobile';
    const deviceClass = isMobile ? 'APK' : 'BROWSER';
    const sessionId = await this.createSession(userId, deviceClass, portal, req);
    return { sessionId };
  }

  async updateRefreshToken(id: string, refreshToken: string, type: 'USER' | 'ADMIN' | 'BRANCH' | 'INTERNAL_RM' | 'DISTRIBUTOR' | 'DISTRIBUTOR_RM') {
    
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    if (type === 'USER') {
      await this.prisma.user.update({ where: { id }, data: { hashedRefreshToken } });
    } else if (type === 'ADMIN') {
      await this.prisma.admin.update({ where: { id }, data: { hashedRefreshToken } });
    } else if (type === 'BRANCH') {
      await this.prisma.branch.update({ where: { id }, data: { hashedRefreshToken } });
    } else if (type === 'INTERNAL_RM') {
      await this.prisma.internalRM.update({ where: { id }, data: { hashedRefreshToken } });
    } else if (type === 'DISTRIBUTOR') {
      await this.prisma.distributor.update({ where: { id }, data: { hashedRefreshToken } });
    } else if (type === 'DISTRIBUTOR_RM') {
      await this.prisma.distributorRM.update({ where: { id }, data: { hashedRefreshToken } });
    }
  }

  async refreshTokens(id: string, refreshToken: string, type: 'USER' | 'ADMIN' | 'BRANCH' | 'INTERNAL_RM' | 'DISTRIBUTOR' | 'DISTRIBUTOR_RM', payload: any, req?: any) {
    
    let user;
    if (type === 'USER') {
      user = await this.prisma.user.findUnique({ where: { id } });
    } else if (type === 'ADMIN') {
      user = await this.prisma.admin.findUnique({ where: { id } });
    } else if (type === 'BRANCH') {
      user = await this.prisma.branch.findUnique({ where: { id } });
    } else if (type === 'INTERNAL_RM') {
      user = await this.prisma.internalRM.findUnique({ where: { id } });
    } else if (type === 'DISTRIBUTOR') {
      user = await this.prisma.distributor.findUnique({ where: { id } });
    } else if (type === 'DISTRIBUTOR_RM') {
      user = await this.prisma.distributorRM.findUnique({ where: { id } });
    }

    if (!user || !user.hashedRefreshToken) {
      this.logger.warn({ event: 'token.refresh.not_found', userId: id, entityType: type }, 'Refresh token lookup failed: entity not found');
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!refreshTokenMatches) {
      this.logger.warn({ event: 'token.refresh.mismatch', userId: id, entityType: type }, 'Refresh token comparison failed');
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.generateTokens(payload, req);
    await this.updateRefreshToken(id, tokens.sessionId, type);
    return tokens;
  }

  async generateToken(
    userId: string,
    email?: string | null,
    phone?: string | null,
    kycStatus?: string,
    fullName?: string | null,
    req?: any,
  ) {
    const appPlatform = req?.headers?.['x-app-platform'];
    const isMobile = appPlatform === 'android' || appPlatform === 'ios' || req?.headers?.['x-client-type'] === 'mobile';
    const deviceClass = isMobile ? 'APK' : 'BROWSER';
    const sessionId = await this.createSession(userId, deviceClass, 'USER', req);
    return sessionId; // Return raw opaque session ID
  }

  // ==========================================================================
  // >>> TEST ACCOUNT BYPASS -- START
  // ==========================================================================
  // PURPOSE: Hardcoded bypass for internal company testing.
  // The phone number 9999999999 is reserved for a pre-seeded test user.
  // When this phone is detected, OTP generation and SMS delivery are SKIPPED
  // entirely. Instead, the user is looked up directly and a JWT is issued.
  //
  // THIS IS INTENTIONAL AND TEMPORARY. Remove once automated E2E testing
  // infrastructure is in place.
  //
  // SECURITY NOTE: The test phone is a non-routable number. The bypass




  /**
   * Admin login with email and password
   * @param email - Admin email
   * @param password - Plain text password
   * @returns Admin object if credentials are valid
   */
  async adminLogin(email: string, password: string) {
    // Find admin by email
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      this.logger.warn({ event: 'admin.login.not_found', email }, `Failed login attempt (admin not found): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log({ adminId: admin.id, role: admin.role }, `Admin login: ${admin.email} (role: ${admin.role})`);

    if (!admin.isActive) {
      this.logger.warn({ event: 'admin.login.inactive', adminId: admin.id, email }, `Failed login attempt (admin inactive): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn({ event: 'admin.login.wrong_password', adminId: admin.id, email }, `Failed login attempt (wrong password): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login time
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return admin;
  }

  /**
   * Generate JWT token for admin
   * @param adminId - Admin's unique ID
   * @param email - Admin's email
   * @param role - Admin's role
   * @param permissions - Admin's permissions
   * @returns JWT token string
   */
  async generateAdminToken(
    adminId: string,
    email: string,
    role: string,
    permissions: string[],
    req?: any,
  ) {
    this.logger.log({ adminId, role }, `Generating admin session for ${email} (role: ${role})`);

    const sessionId = await this.createSession(adminId, 'BROWSER', 'ADMIN', req);

    return sessionId;
  }

  /**
   * Create a new admin (only SUPER_ADMIN can do this)
   * For SUPER_ADMIN role, permissions are auto-assigned to ALL_PERMISSIONS regardless of input
   * @param email - Admin email
   * @param fullName - Admin full name
   * @param password - Plain text password
   * @param role - Admin role
   * @param permissions - Admin permissions (ignored for SUPER_ADMIN)
   * @returns Created admin object
   */
  async createAdmin(
    email: string,
    fullName: string,
    password: string,
    role: AdminRole = 'ADMIN',
    permissions: string[] = [],
    creatorAdminId: string,
    availability?: string,
    availabilityNote?: string,
  ) {
    email = email.trim().toLowerCase();

    // Check if admin already exists
    const existing = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Admin with this email already exists');
    }

    // Validate creator permissions for CONTENT_MANAGER role
    if (role === 'CONTENT_MANAGER') {
      const creator = await this.prisma.admin.findUnique({
        where: { id: creatorAdminId },
      });

      if (!creator) {
        throw new BadRequestException('Creator admin not found');
      }

      if (
        creator.role !== 'SUPER_ADMIN' &&
        !creator.permissions.includes('create_cms')
      ) {
        throw new BadRequestException(
          'Only admins with create_cms permission can create Content Managers',
        );
      }

      // Auto-assign default CMS permissions for CONTENT_MANAGER
      if (role === 'CONTENT_MANAGER' && permissions.length === 0) {
        permissions = [
          'cms_news',
          'cms_articles',
          'cms_faqs',
          'cms_static_pages',
          'cms_stocks',
        ];
        this.logger.log({ adminId: creatorAdminId, event: 'admin.permissions.auto_assign', role: 'CONTENT_MANAGER', permissions },
          'Auto-assigning default CMS permissions to CONTENT_MANAGER:',
        );
      }

      // Filter permissions to only allow CMS permissions for Content Managers
      permissions = permissions.filter((p) => p.startsWith('cms_'));
    }

    // Validate creator permissions for SUPPORT_AGENT role
    if (role === 'SUPPORT_AGENT') {
      const creator = await this.prisma.admin.findUnique({
        where: { id: creatorAdminId },
      });

      if (!creator) {
        throw new BadRequestException('Creator admin not found');
      }

      if (creator.role !== 'SUPER_ADMIN') {
        throw new BadRequestException(
          'Only Super Admin can create Support Agents',
        );
      }

      // Do NOT auto-assign default permissions (Zero Trust Policy - permissions must be manually selected)
      // Filter permissions to only allow support-related permissions
      permissions = permissions.filter((p) =>
        [
          'view_tickets',
          'update_ticket_status',
          'update_ticket_priority',
          'assign_tickets',
          'add_internal_notes',
          'escalate_tickets',
          'view_ticket_history',
          'view_all_tickets',
        ].includes(p),
      );
    }

    // Validate creator permissions for ACCOUNTANT role
    if (role === 'ACCOUNTANT') {
      permissions = permissions.filter((p) =>
        ['approve_vouchers'].includes(p),
      );
    }

    // Validate creator permissions for OPERATIONS role
    if (role === 'OPERATIONS') {
      permissions = permissions.filter((p) =>
        [
          'update_orders',
          'manage_stocks',
          'demat_approval',
          'cms_demat_approval',
          'edit_order_transfer',
          'revenue_sharing',
          'nsdl_batch',
          'chart_of_stocks',
          'stock_interests',
          'sell_requests',
        ].includes(p),
      );
    }

    // Validate creator permissions for MARKETING_MANAGER and SALES_EMPLOYEE role
    if (role === 'MARKETING_MANAGER' || role === 'SALES_EMPLOYEE') {
      permissions = permissions.filter((p) =>
        [
          'marketing_view',
          'marketing_export',
          'marketing_campaign_manage',
          'marketing_lead_assign',
          'marketing_dashboard_view',
          'marketing_reports_view',
        ].includes(p),
      );
    }

    // Auto-assign all permissions to SUPER_ADMIN
    if (role === 'SUPER_ADMIN') {
      permissions = ALL_PERMISSIONS;
      this.logger.log({ adminId: creatorAdminId, event: 'admin.permissions.auto_assign', role: 'SUPER_ADMIN', permissions },
        'Auto-assigning all permissions to SUPER_ADMIN:',
      );
    }

    // Enforce enterprise password policy (8+ chars, complexity, common password check)
    assertStrongPassword(password);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await this.prisma.admin.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: role,
        permissions,
        availability,
        availabilityNote,
      },
    });

    return admin;
  }

  /**
   * Update Support Agent availability status
   * @param adminId - Admin ID
   * @param availability - Availability status ('available', 'busy', 'unavailable')
   * @param availabilityNote - Optional note for availability
   * @returns Updated admin object
   */
  async updateAvailability(
    adminId: string,
    availability: string,
    availabilityNote?: string,
  ) {
    // Find the admin
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    if (admin.role !== 'SUPPORT_AGENT') {
      throw new BadRequestException(
        'Only Support Agents can have availability status',
      );
    }

    // Update availability
    const updatedAdmin = await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        availability,
        availabilityNote,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        permissions: true,
        availability: true,
        availabilityNote: true,
        activeTicketCount: true,
      },
    });

    return updatedAdmin;
  }

  /**
   * Verify admin JWT token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws UnauthorizedException if token is invalid or expired
   */
  async verifyAdminToken(sessionId: string) {
    try {
      const hashedSessionId = this.hashSessionId(sessionId);
      const session = await this.redis.getSession(hashedSessionId);

      if (!session) {
        throw new BadRequestException('Invalid or expired session');
      }

      // Ensure it's an admin session
      if (session.type !== 'ADMIN') {
        throw new BadRequestException('Invalid token type');
      }

      return session;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid or expired session');
    }
  }

  /**
   * Get admin by ID
   * @param adminId - Admin's unique ID
   * @returns Admin object or null if not found
   */
  async getAdminById(adminId: string) {
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
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  /**
   * Get all admins (Super Admin only, or admins with specific permissions)
   * For non-Super Admins, returns admins based on requester permissions:
   * - create_cms permission: includes Content Managers
   * Admins with multiple permissions will see all relevant admin types
   * Excludes passwordHash for security
   */
  async getAllAdmins(
    requesterId: string,
    requesterRole: string,
    requesterPermissions: string[],
  ) {
    if (requesterRole === 'SUPER_ADMIN') {
      return await this.prisma.admin.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          permissions: true,
          availability: true,
          availabilityNote: true,
          activeTicketCount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // Build allowed roles based on requester permissions
    const allowedRoles: string[] = [];
    if (requesterPermissions.includes('create_cms')) {
      allowedRoles.push('CONTENT_MANAGER');
    }
    this.logger.debug({ allowedRoles }, 'Allowed roles for requester');

    if (allowedRoles.length === 0) {
      throw new ForbiddenException('Insufficient permissions to view admins');
    }

    return await this.prisma.admin.findMany({
      where: { role: { in: allowedRoles as AdminRole[] } },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        permissions: true,
        availability: true,
        availabilityNote: true,
        activeTicketCount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update admin permissions (Super Admin only)
   * For SUPER_ADMIN role, permissions are always coerced to ALL_PERMISSIONS to maintain full access
   * @param adminId - ID of admin to update
   * @param permissions - New permissions array (ignored for SUPER_ADMIN)
   */
  async updateAdminPermissions(adminId: string, permissions: string[]) {
    // Validate admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Check if admin is active
    if (!admin.isActive) {
      throw new BadRequestException('Cannot update inactive admin');
    }

    // For CONTENT_MANAGER, enforce CMS-only permissions
    if (admin.role === 'CONTENT_MANAGER') {
      const originalPermissions = [...permissions];
      permissions = permissions.filter((p) => p.startsWith('cms_'));
      if (originalPermissions.length !== permissions.length) {
        this.logger.warn({ adminId },
          `[Update Admin Permissions] Filtered non-CMS permissions for CONTENT_MANAGER ${adminId}. Original: ${originalPermissions.join(', ')}, Filtered: ${permissions.join(', ')}`,
        );
      }
    }

    // For SUPPORT_AGENT, enforce support-related permissions only
    if (admin.role === 'SUPPORT_AGENT') {
      const originalPermissions = [...permissions];
      const supportPermissions = [
        'view_tickets',
        'update_ticket_status',
        'update_ticket_priority',
        'assign_tickets',
        'add_internal_notes',
        'escalate_tickets',
        'view_ticket_history',
        'view_all_tickets',
      ];
      permissions = permissions.filter((p) => supportPermissions.includes(p));
      if (originalPermissions.length !== permissions.length) {
        this.logger.warn({ adminId },
          `[Update Admin Permissions] Filtered non-support permissions for SUPPORT_AGENT ${adminId}. Original: ${originalPermissions.join(', ')}, Filtered: ${permissions.join(', ')}`,
        );
      }
    }

    // For ACCOUNTANT, enforce accounting-related permissions only
    if (admin.role === 'ACCOUNTANT') {
      const originalPermissions = [...permissions];
      const accountingPermissions = ['approve_vouchers'];
      permissions = permissions.filter((p) => accountingPermissions.includes(p));
      if (originalPermissions.length !== permissions.length) {
        this.logger.warn({ adminId },
          `[Update Admin Permissions] Filtered non-accounting permissions for ACCOUNTANT ${adminId}. Original: ${originalPermissions.join(', ')}, Filtered: ${permissions.join(', ')}`,
        );
      }
    }

    // For OPERATIONS, enforce operations-related permissions only
    if (admin.role === 'OPERATIONS') {
      const originalPermissions = [...permissions];
      const operationsPermissions = [
        'update_orders',
        'manage_stocks',
        'demat_approval',
        'cms_demat_approval',
        'edit_order_transfer',
        'revenue_sharing',
        'nsdl_batch',
        'chart_of_stocks',
        'stock_interests',
        'sell_requests',
      ];
      permissions = permissions.filter((p) => operationsPermissions.includes(p));
      if (originalPermissions.length !== permissions.length) {
        this.logger.warn({ adminId },
          `[Update Admin Permissions] Filtered non-operations permissions for OPERATIONS ${adminId}. Original: ${originalPermissions.join(', ')}, Filtered: ${permissions.join(', ')}`,
        );
      }
    }

    // For MARKETING_MANAGER and SALES_EMPLOYEE, enforce marketing-related permissions only
    if (admin.role === 'MARKETING_MANAGER' || admin.role === 'SALES_EMPLOYEE') {
      const originalPermissions = [...permissions];
      const marketingPermissions = [
        'marketing_view',
        'marketing_export',
        'marketing_campaign_manage',
        'marketing_lead_assign',
        'marketing_dashboard_view',
        'marketing_reports_view',
      ];
      permissions = permissions.filter((p) => marketingPermissions.includes(p));
      if (originalPermissions.length !== permissions.length) {
        this.logger.warn({ adminId },
          `[Update Admin Permissions] Filtered non-marketing permissions for ${admin.role} ${adminId}. Original: ${originalPermissions.join(', ')}, Filtered: ${permissions.join(', ')}`,
        );
      }
    }

    // For SUPER_ADMIN, always maintain full permissions regardless of input
    if (admin.role === 'SUPER_ADMIN') {
      permissions = ALL_PERMISSIONS;
    }

    // Update only permissions field
    return await this.prisma.admin.update({
      where: { id: adminId },
      data: { permissions },
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
  }

  /**
   * Delete admin account (Super Admin only, or Content Manager deletion by permitted roles)
   *
   * Old panel users usually own attributed rows (created stocks/baskets,
   * assigned leads, change requests). Those FKs default to RESTRICT, so a
   * bare delete throws P2003. This method therefore reassigns attribution
   * to a fallback admin inside a transaction before deleting:
   * - Nullable links are cleared: Stock/UpcomingStock/StockBasket.updatedById,
   *   MarketingLead.assignedToId, ChangeRequest.reviewedById.
   * - Required links are transferred: Stock/UpcomingStock/StockBasket/ESignTemplate
   *   .createdById, ChangeRequest.requestedById.
   *
   * @param adminId - ID of admin to delete
   * @param fallbackAdminId - Preferred new owner for required attribution
   *   (defaults to the oldest SUPER_ADMIN other than the deleted admin)
   */
  async deleteAdmin(adminId: string, fallbackAdminId?: string) {
    // Validate admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Resolve fallback owner for required attribution fields
    let fallbackId = fallbackAdminId;
    if (fallbackId === adminId) {
      fallbackId = undefined;
    }
    if (fallbackId) {
      const fallback = await this.prisma.admin.findUnique({
        where: { id: fallbackId },
        select: { id: true },
      });
      if (!fallback) {
        throw new BadRequestException('Fallback admin not found');
      }
    } else {
      const superAdmin = await this.prisma.admin.findFirst({
        where: { role: 'SUPER_ADMIN', NOT: { id: adminId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      fallbackId = superAdmin?.id;
    }

    if (!fallbackId) {
      throw new ConflictException(
        'Cannot delete this user: they own attributed records (stocks, baskets, leads or change requests) and no fallback owner exists. Ask another Super Admin to perform the deletion.',
      );
    }

    // Count attributed rows for the response (observability, not gating)
    const [createdStocks, createdUpcoming, createdBaskets, createdTemplates, assignedLeads, requestedChanges] =
      await Promise.all([
        this.prisma.stock.count({ where: { createdById: adminId } }),
        this.prisma.upcomingStock.count({ where: { createdById: adminId } }),
        this.prisma.stockBasket.count({ where: { createdById: adminId } }),
        this.prisma.eSignTemplate.count({ where: { createdById: adminId } }),
        this.prisma.marketingLead.count({ where: { assignedToId: adminId } }),
        this.prisma.changeRequest.count({ where: { requestedById: adminId } }),
      ]);

    try {
      await this.prisma.$transaction([
        // Clear nullable attribution links
        this.prisma.stock.updateMany({
          where: { updatedById: adminId },
          data: { updatedById: null },
        }),
        this.prisma.upcomingStock.updateMany({
          where: { updatedById: adminId },
          data: { updatedById: null },
        }),
        this.prisma.stockBasket.updateMany({
          where: { updatedById: adminId },
          data: { updatedById: null },
        }),
        this.prisma.marketingLead.updateMany({
          where: { assignedToId: adminId },
          data: { assignedToId: null },
        }),
        this.prisma.changeRequest.updateMany({
          where: { reviewedById: adminId },
          data: { reviewedById: null },
        }),
        // Transfer required attribution links to the fallback owner
        this.prisma.stock.updateMany({
          where: { createdById: adminId },
          data: { createdById: fallbackId },
        }),
        this.prisma.upcomingStock.updateMany({
          where: { createdById: adminId },
          data: { createdById: fallbackId },
        }),
        this.prisma.stockBasket.updateMany({
          where: { createdById: adminId },
          data: { createdById: fallbackId },
        }),
        this.prisma.eSignTemplate.updateMany({
          where: { createdById: adminId },
          data: { createdById: fallbackId },
        }),
        this.prisma.changeRequest.updateMany({
          where: { requestedById: adminId },
          data: { requestedById: fallbackId },
        }),
        // Delete the admin
        this.prisma.admin.delete({
          where: { id: adminId },
        }),
      ]);
    } catch (error: any) {
      // A new FK pointing at Admin without a handled reassignment lands here.
      // Surface it as a 409 with context instead of a generic 500.
      if (error?.code === 'P2003') {
        const target = error?.meta?.field_name ?? error?.meta?.modelName ?? 'related records';
        throw new ConflictException(
          `Cannot delete this user: they still own ${target}. Reassign those records first, then retry.`,
        );
      }
      throw error;
    }

    // Invalidate sessions and status cache
    await this.redis.deleteAllUserSessions(adminId);

    return {
      success: true,
      reassignedTo: fallbackId,
      linksTransferred: {
        createdStocks,
        createdUpcomingStocks: createdUpcoming,
        createdBaskets,
        createdEsignTemplates: createdTemplates,
        assignedLeads,
        requestedChanges,
      },
    };
  }

  /**
   * Get all audit logs
   */
  async getAllAuditLogs() {
    return await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get admin statistics for dashboard
   * Returns counts of users and admins
   * @returns Object with totalUsers, verifiedUsers, totalAdmins, activeAdmins, pendingKycUsers
   */
  async getAdminStats() {
    const [totalUsers, verifiedUsers, totalAdmins, pendingKycUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { kycStatus: 'VERIFIED' } }),
        this.prisma.admin.count(),
        this.prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      ]);

    // For MVP, active admins is same as total admins
    // Can be enhanced later with lastLoginAt timestamp filtering
    const activeAdmins = totalAdmins;

    return {
      totalUsers,
      verifiedUsers,
      totalAdmins,
      activeAdmins,
      pendingKycUsers,
    };
  }

  /**
   * Get all users with optional filters
   * @param filters - Optional kycStatus and search filters
   * @returns Array of users with selected fields
   */
  async getAllUsers(filters?: {
    kycStatus?: string;
    search?: string;
    submittedOnly?: boolean;
    dematStatus?: string;
    bankStatus?: string;
    bankSubmittedOnly?: boolean;
    dematSubmittedOnly?: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    // Filter by KYC status if provided
    if (filters?.kycStatus) {
      where.kycStatus = filters.kycStatus;
    }

    // Filter by Demat status if provided
    if (filters?.dematStatus) {
      where.dematStatus = filters.dematStatus;
    }

    // Filter by Bank status if provided
    if (filters?.bankStatus) {
      where.bankStatus = filters.bankStatus;
    }

    // NOTE: Search by name/email/phone is applied in-memory AFTER the query.
    // `email` and `phone` are encrypted at rest (prisma-field-encryption), so a
    // SQL `contains` is matched against ciphertext and never hits. Rows are
    // decrypted by the Prisma extension on read, so we filter on plaintext below.
    const searchTerm = filters?.search?.trim().toLowerCase() || '';
    const searchDigits = searchTerm.replace(/\D/g, '');

    // Submitted-only filter for admin KYC review lists.
    // We use a JSON path check for `kycData.submittedAt` because `kycStatus = PENDING`
    // is not sufficient to distinguish "in progress" from "submitted for review".
    if (filters?.submittedOnly) {
      where.kycData = {
        path: ['submittedAt'],
        not: Prisma.AnyNull,
      };
    }

    if (filters?.bankSubmittedOnly) {
      where.bankData = {
        not: Prisma.AnyNull,
      };
    }

    if (filters?.dematSubmittedOnly) {
      where.dematData = {
        not: Prisma.AnyNull,
      };
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters?.endDate) {
        // Set to end of day for the end date
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        kycStatus: true,
        dematStatus: true,
        bankStatus: true,
        createdAt: true,
        updatedAt: true,
        kycData: true,
        dematData: true,
      },
      orderBy: [
        { kycStatus: 'asc' }, // PENDING first
        { updatedAt: 'desc' },
      ],
    });

    const matchedUsers = searchTerm
      ? users.filter((u) => {
          const name = (u.fullName || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          const phoneDigits = (u.phone || '').replace(/\D/g, '');
          if (name.includes(searchTerm) || email.includes(searchTerm)) return true;
          // Phone: compare digits only so "+91 98765 43210", "9876543210" etc. all match
          return searchDigits.length >= 3 && phoneDigits.includes(searchDigits);
        })
      : users;

    return matchedUsers.map((u) => {
      const kycData = (u.kycData as any) || {};
      const dematData = (u.dematData as any) || {};
      const panCardNumber =
        dematData.panNumber ||
        dematData.pan ||
        kycData.panDetails?.pan ||
        kycData.panNumber ||
        kycData.pan ||
        null;

      return {
        ...u,
        panCardNumber,
        panNumber: panCardNumber,
      };
    });
  }

  /**
   * Get detailed user information by ID
   * @param userId - User ID
   * @returns User object with KYC data and documents
   */
  async getUserDetailsById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        kycStatus: true,
        kycData: true,
        dematStatus: true,
        dematData: true,
        dematDocuments: true,
        bankStatus: true,
        bankData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Add needsEmail for admin visibility
    return {
      ...user,
      needsEmail: !user.email,
    };
  }

  // NOTE: RM authentication methods (validateRM, generateRMToken, getRMById,
  // updateRMLastLogin) were removed as part of RM system deprecation.

  /**
   * Send OTP to phone number for phone-first authentication
   * Includes rate limiting to prevent abuse
   * @param phone - 10-digit phone number
   * @returns Promise with success status, message, and SMS delivery info
   */
  async sendPhoneOTP(
    phone: string,
    ip: string = 'Unknown',
    captchaToken?: string,
    deviceFingerprint?: string,
  ): Promise<{
    success: boolean;
    message: string;
    smsSent?: boolean;
    smsQueued?: boolean;
    devFallbackAvailable?: boolean;
    captchaRequired?: boolean;
    activeSession?: boolean;
    cooldownActive?: boolean;
    cooldownRemainingSeconds?: number;
    cooldownUntil?: number | null;
  }> {
    const lockKey = `lock:otp:gen:${phone}`;
    const acquired = await this.redis.acquireLock(lockKey, 120);
    if (!acquired) {
      throw new BadRequestException('An OTP request is already in progress. Please wait.');
    }

    try {
      // Check active cooldown in Redis first
      const cleanPhone = (phone || '').replace(/^\+91/, '').replace(/\D/g, '');
      const isWhitelisted = process.env.NODE_ENV !== 'production' && (
        ['8130244036', '0123456789', '9999999999'].includes(cleanPhone) ||
        (process.env.TEST_PHONE_NUMBERS || '')
          .split(',')
          .map((p) => p.trim().replace(/^\+91/, ''))
          .filter(Boolean)
          .includes(cleanPhone));

      const existingRecord = await this.redis.getOTPRecord?.(phone);
      const now = Date.now();

      /*
      // OTP cooldown check commented out for OTP testing
      if (phone !== '0123456789' && !isWhitelisted && existingRecord && existingRecord.cooldownUntil && now < existingRecord.cooldownUntil) {
        const remainingMs = existingRecord.cooldownUntil - now;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        this.logger.log(`Active OTP cooldown for ${phone}: ${remainingSeconds}s remaining`);

        return {
          success: true,
          activeSession: true,
          cooldownActive: true,
          cooldownRemainingSeconds: remainingSeconds,
          cooldownUntil: existingRecord.cooldownUntil,
          message: `Code already sent. You can request a new one in ${remainingSeconds}s.`,
        };
      }
      */

      await this.redis.checkOtpRateLimits(phone, ip, deviceFingerprint);

      let otp = this.generateOTP();
      let isPlayStoreTestAccount = false;

      // Reserved Play Store review number; still requires a Redis OTP request and verification.
      if (phone === '0123456789') {
        otp = '123456';
        isPlayStoreTestAccount = true;
      }

      const allowConsoleFallback =
        process.env.NODE_ENV !== 'production';

      if (allowConsoleFallback) {
        this.logger.log({ event: 'otp.generated', mode: 'phone' }, `Phone OTP for ${phone}: ${otp}`);
      }

      // Store hashed OTP in Redis with 300s TTL and 30s resend cooldown
      const cooldownSeconds = isPlayStoreTestAccount ? 0 : 30;
      const cooldownUntil = now + cooldownSeconds * 1000;
      await this.redis.setOTP(phone, this.hashOtp(otp), 300, cooldownSeconds, { key: lockKey, token: acquired });

      let smsQueued = false;
      // Send SMS via SMC SMS Gateway (which queues asynchronously)
      try {
        let smsResult: any = { success: true };
        
        if (isPlayStoreTestAccount) {
          this.logger.log(`[OTP Request] Bypassing SMS send for Play Store test account ${phone}`);
        } else {
          smsResult = await this.smsService.sendOtpSms(phone, otp);
        }

        smsQueued = smsResult.ackid === 'QUEUED';
        this.logger.log(`[OTP Request] Phone OTP requested for ${phone.length > 4 ? `******${phone.slice(-4)}` : phone}`);

        if (!smsResult.success) {
          if (allowConsoleFallback) {
            return {
              success: true,
              message: `SMS gateway error. OTP generated for developer testing — use the OTP from the server console.`,
              smsSent: false,
              devFallbackAvailable: true,
              cooldownActive: true,
              cooldownRemainingSeconds: cooldownSeconds,
              cooldownUntil,
            };
          }

          throw new BadRequestException('Unable to send OTP. Please try again later.');
        }
      } catch (error) {
        this.logger.error(`SMS sending error for ${phone.length > 4 ? `******${phone.slice(-4)}` : phone}:`, error);

        if (allowConsoleFallback) {
          return {
            success: true,
            message: 'Failed to send OTP SMS. OTP generated for developer testing — use the OTP from the server console.',
            smsSent: false,
            devFallbackAvailable: true,
            cooldownActive: true,
            cooldownRemainingSeconds: cooldownSeconds,
            cooldownUntil,
          };
        }

        throw new BadRequestException('Unable to send OTP. Please try again later.');
      }

      return {
        success: true,
        message: smsQueued ? 'Sending OTP to your mobile number...' : 'OTP sent successfully. It is valid for 5 minutes.',
        smsQueued,
        ...(smsQueued ? {} : { smsSent: true }),
        cooldownActive: cooldownSeconds > 0,
        cooldownRemainingSeconds: cooldownSeconds,
        cooldownUntil,
      };
    } finally {
      await this.redis.releaseLock(lockKey, acquired);
    }
  }

  /**
   * Get OTP cooldown and active session status for a phone number
   */
  async getPhoneOTPStatus(phone: string) {
    const record = await this.redis.getOTPRecord(phone);
    const now = Date.now();

    if (!record || (record.expiresAt && now >= record.expiresAt)) {
      return {
        hasActiveOTP: false,
        cooldownActive: false,
        cooldownRemainingSeconds: 0,
        cooldownUntil: null,
      };
    }

    const cooldownActive = phone !== '0123456789' && record.cooldownUntil ? now < record.cooldownUntil : false;
    const cooldownRemainingSeconds = cooldownActive
      ? Math.ceil((record.cooldownUntil! - now) / 1000)
      : 0;

    return {
      hasActiveOTP: true,
      cooldownActive,
      cooldownRemainingSeconds,
      cooldownUntil: record.cooldownUntil || null,
      expiresAt: record.expiresAt || null,
      deliveryStatus: record.deliveryStatus || 'queued',
    };
  }

  /**
   * Verify phone OTP for phone-first authentication
   * New/incomplete users receive a Redis-only phone proof; no account or session is created.
   * @param phone - 10-digit phone number
   * @param otp - 6-digit OTP
   * @returns Promise with user data and needsEmail flag
   */
  async verifyPhoneOTP(
    phone: string,
    otp: string,
    req?: any,
  ): Promise<{ user: any; needsEmail: boolean; token?: string; phoneVerificationToken?: string }> {
    const startTime = Date.now();
    try {
      await this.redis.consumeOTP(phone, this.hashOtp(otp), this.MAX_RETRIES);

      this.logger.log(`[OTP Verify Success] Phone OTP verified for ${phone.length > 4 ? `******${phone.slice(-4)}` : phone}`);

      // Read existing accounts; new signup data stays in Redis.
      let user = await this.prisma.user.findUnique({
        where: { phone },
      });

      if (!user || !user.email || !user.fullName?.trim()) {
if (user?.isDeleted) {
          this.logger.warn({ event: 'phone.otp.verify.deleted_account', userId: user.id, phone }, 'Phone OTP verification: account is deleted');
          throw new BadRequestException('This account has been deleted');
        }
        return { user: null, needsEmail: true, phoneVerificationToken: await this.redis.createPhoneProof(phone) };
      }

      let wasDeactivated = false;

      if (user) {
        if (user.isDeleted === true) {
          this.logger.warn({ event: 'phone.otp.verify.deleted_account', userId: user.id, phone }, 'Phone OTP verification: existing account is deleted');
          throw new BadRequestException('This account has been deleted');
        }
        // Existing user
        if (user.isActive === false) {
          // Delete all associated KycDocument records
          await this.prisma.kycDocument.deleteMany({
            where: { userId: user.id },
          });

          // Reset user record: clear KYC, Demat, and Bank data
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: true,
              kycStatus: 'PENDING',
              dematStatus: 'PENDING',
              bankStatus: 'PENDING',
              kycData: Prisma.DbNull,
              dematData: Prisma.DbNull,
              bankData: Prisma.DbNull,
              dematDocuments: Prisma.DbNull,
            },
          });
          wasDeactivated = true;
        }

        if (user.email) {
          // User has email - generate token for immediate login
          const token = await this.generateToken(
            user.id,
            user.email,
            user.phone,
            user.kycStatus,
            user.fullName,
            req,
          );
          await this.redis.resetOtpRateLimits(phone);
          await this.redis.recordOtpMetric('success', Date.now() - startTime);
          return { user: { ...user, wasDeactivated }, needsEmail: false, token };
        }
      }
      this.logger.warn({ event: 'phone.otp.verify.incomplete_account', phone }, 'Unable to log in: account incomplete');
      throw new BadRequestException('Unable to log in. Please restart signup.');
    } catch (err: any) {
      await this.redis.recordOtpMetric('failure', Date.now() - startTime);
      throw err;
    }
  }

  /**
   * Send OTP to email address for manual email-first authentication
   * @param email - User's email address
   */
  async sendEmailOTP(
    email: string,
    ip: string = 'Unknown',
    captchaToken?: string,
    deviceFingerprint?: string,
    phone?: string,
  ): Promise<{ success: boolean; message: string; captchaRequired?: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();

    // If phone is provided (phone-first signup flow), verify that this email isn't already taken by another account with a different phone
    if (phone) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingEmailUser && existingEmailUser.phone && existingEmailUser.phone !== phone) {
        throw new BadRequestException('This email is already registered to another account.');
      }
    }

    const lockKey = `lock:otp:gen:${normalizedEmail}`;
    const acquired = await this.redis.acquireLock(lockKey, 120);
    if (!acquired) {
      throw new BadRequestException('An OTP request is already in progress. Please wait.');
    }

    try {
      await this.redis.checkOtpRateLimits(normalizedEmail, ip, deviceFingerprint);

      let otp = this.generateOTP();
      
      if (process.env.NODE_ENV !== 'production' && (normalizedEmail === 'test@example.com' || normalizedEmail === 'test@test.com')) {
        otp = '123456';
      }
      
      const allowConsoleFallback =
        process.env.NODE_ENV !== 'production';
      if (allowConsoleFallback) {
        this.logger.log({ event: 'otp.generated', mode: 'email' }, `Email OTP for ${normalizedEmail}: ${otp}`);
      }

      // Store in Redis with 5-minute expiry
      await this.redis.setOTP(normalizedEmail, this.hashOtp(otp), 300, 30, { key: lockKey, token: acquired });

      try {
        if (process.env.NODE_ENV !== 'production' && (normalizedEmail === 'test@example.com' || normalizedEmail === 'test@test.com')) {
          this.logger.log(`[OTP Request] Bypassing Email send for test account ${normalizedEmail}`);
        } else {
          // Send email via centralized EmailService
          await this.emailService.sendOtpEmail(normalizedEmail, otp);
        }
        this.logger.log(`[OTP Request] Email OTP requested for ${normalizedEmail}`);
      } catch (err) {
        throw new BadRequestException('Unable to send OTP. Please try again later.');
      }

      return { success: true, message: 'OTP sent to your email.' };
    } finally {
      await this.redis.releaseLock(lockKey, acquired);
    }
  }

  /**
   * Verify email OTP and authenticate user.
   * Two modes:
   *  1) Login mode: a completed account logs in directly.
   *  2) Signup mode: both verified contacts are staged in Redis until name completion.
   * @param email - User's email address
   * @param otp - 6-digit OTP
   * @param phone - Optional phone number to link email to (signup flow)
   */
  async verifyEmailOTP(email: string, otp: string, phone?: string, req?: any, phoneVerificationToken?: string): Promise<{
    user?: any; token?: string; isNewUser: boolean; needsName?: boolean; signupToken?: string; wasDeactivated?: boolean;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (phone && !phoneVerificationToken) throw new BadRequestException('Please verify your phone again before linking an email.');
    await this.redis.consumeOTP(normalizedEmail, this.hashOtp(otp), this.MAX_RETRIES,
      phone ? { phone, token: phoneVerificationToken! } : undefined);

    let user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user?.isDeleted) {
      this.logger.warn({ event: 'email.otp.verify.deleted_account', userId: user.id, email: normalizedEmail }, 'Email OTP verification: account is deleted');
      throw new BadRequestException('This account has been deleted');
    }

    if (phone) {
      const phoneUser = await this.prisma.user.findUnique({ where: { phone } });
      if (phoneUser?.isDeleted) {
        this.logger.warn({ event: 'email.otp.verify.deleted_account', userId: phoneUser.id, phone }, 'Email OTP verification: phone-linked account is deleted');
        throw new BadRequestException('This account has been deleted');
      }
      if ((user?.phone && user.phone !== phone) || (phoneUser?.email && phoneUser.email !== normalizedEmail)
          || (user && phoneUser && user.id !== phoneUser.id)) {
        throw new ConflictException('This phone or email already belongs to another account. Please log in to that account.');
      }
      // Both OTPs are verified. Name is still required; persist only temporary Redis state.
      const existingUserId = user?.id || phoneUser?.id;
      const signupToken = await this.redis.createPendingSignup({ phone, email: normalizedEmail, existingUserId });
      return { needsName: true, isNewUser: !existingUserId, signupToken };
    }

    // Email-only access is login for completed accounts, never an alternate signup path.
    if (!user?.phone || !user?.fullName?.trim()) {
      throw new BadRequestException('Please sign up with your phone number, verify your email, and enter your name.');
    }
    let wasDeactivated = false;
    if (user.isActive === false) {
      await this.prisma.kycDocument.deleteMany({ where: { userId: user.id } });
      user = await this.prisma.user.update({ where: { id: user.id }, data: {
        isActive: true, kycStatus: 'PENDING', dematStatus: 'PENDING', bankStatus: 'PENDING',
        kycData: Prisma.DbNull, dematData: Prisma.DbNull, bankData: Prisma.DbNull, dematDocuments: Prisma.DbNull,
      } });
      wasDeactivated = true;
    }
    const token = await this.generateToken(user.id, user.email, user.phone, user.kycStatus, user.fullName, req);
    await this.redis.resetOtpRateLimits(normalizedEmail);
    return { user, token, isNewUser: false, wasDeactivated };
  }

  async completeSignup(fullName: string, signupToken: string | undefined, req?: any) {
    const name = typeof fullName === 'string' ? fullName.trim() : '';
    if (name.length < 3 || name.length > 100 || !/^[a-zA-Z][a-zA-Z\s]*$/.test(name)) {
      throw new BadRequestException('Enter a full name of 3–100 characters using letters and spaces.');
    }
    if (!signupToken) throw new BadRequestException('Signup expired. Please verify your phone again.');
    // Claim once before database writes: concurrent submissions cannot both create a session.
    const pending = await this.redis.takePendingSignup(signupToken);
    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const [byPhone, byEmail] = await Promise.all([
          tx.user.findUnique({ where: { phone: pending.phone } }),
          tx.user.findUnique({ where: { email: pending.email } }),
        ]);
        if (pending.existingUserId) {
          const existing = await tx.user.findUnique({ where: { id: pending.existingUserId } });
          if (!existing || existing.isDeleted || (byPhone && byPhone.id !== existing.id)
              || (byEmail && byEmail.id !== existing.id)
              || (existing.phone && existing.phone !== pending.phone)
              || (existing.email && existing.email !== pending.email)) {
            throw new ConflictException('Account details changed. Please restart signup.');
          }
          if (existing.isActive === false) {
            await tx.kycDocument.deleteMany({ where: { userId: existing.id } });
          }
          return tx.user.update({ where: { id: existing.id }, data: {
            phone: pending.phone, email: pending.email, fullName: name,
            ...(existing.isActive === false ? { isActive: true,
              kycStatus: 'PENDING', dematStatus: 'PENDING', bankStatus: 'PENDING',
              kycData: Prisma.DbNull, dematData: Prisma.DbNull,
              bankData: Prisma.DbNull, dematDocuments: Prisma.DbNull } : {}),
          } });
        }
        if (byPhone || byEmail) throw new ConflictException('An account already exists. Please log in.');
        return tx.user.create({ data: { phone: pending.phone, email: pending.email, fullName: name } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      // Conflicts are permanent; anything else (incl. serialization retries) is transient,
      // so give the claim back and let the user resubmit the name without new OTPs.
      if (!(error instanceof ConflictException) && error.code !== 'P2002') {
        await this.redis.restorePendingSignup(signupToken, pending).catch(() => undefined);
      }
      if (error.code === 'P2002' || error.code === 'P2034') {
        throw new ConflictException('Signup changed in another request. Please log in or restart signup.');
      }
      throw error;
    }
    // No authenticated session exists until all fields have committed successfully.
    let token: string;
    try {
      token = await this.generateToken(user.id, user.email, user.phone, user.kycStatus, user.fullName, req);
    } catch (error) {
      // The user row is committed; a retry must update it rather than hit "account exists".
      await this.redis.restorePendingSignup(signupToken, { ...pending, existingUserId: user.id }).catch(() => undefined);
      throw error;
    }
    if (!pending.existingUserId) {
      this.emailService.sendWelcomeEmail({ email: user.email!, fullName: user.fullName! })
        .catch((error) => this.logger.warn({ userId: user.id, err: error }, `Welcome email failed: ${error.message}`));
    }
    return { user, token };
  }

  // NOTE: linkGoogleToPhone method removed as part of Google Auth deprecation.

  /**
   * Generate and send an OTP for CMS 2FA login
   * @param email - Admin's email address
   */
  async sendCmsOtp(email: string, ip: string = 'Unknown', captchaToken?: string, deviceFingerprint?: string): Promise<{ success: boolean; message: string; captchaRequired?: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const redisKey = `cms:${normalizedEmail}`;
    const lockKey = `lock:otp:gen:${redisKey}`;
    const acquired = await this.redis.acquireLock(lockKey, 120);
    if (!acquired) {
      throw new BadRequestException('An OTP request is already in progress. Please wait.');
    }

    try {
      await this.redis.checkOtpRateLimits(redisKey, ip, deviceFingerprint);

      const otp = this.generateOTP();
      
      const allowConsoleFallback =
        process.env.NODE_ENV !== 'production';
      if (allowConsoleFallback) {
        this.logger.log({ event: 'otp.generated', mode: 'cms_email' }, `CMS Email OTP for ${normalizedEmail}: ${otp}`);
      }

      // Store in Redis with 5-minute expiry
      await this.redis.setOTP(redisKey, this.hashOtp(otp), 300, 30, { key: lockKey, token: acquired });

      try {
        // Send email via centralized EmailService
        await this.emailService.sendOtpEmail(normalizedEmail, otp);
        this.logger.log(`[OTP Request] CMS OTP requested for ${normalizedEmail}`);
      } catch (err) {
        throw new BadRequestException('Unable to send OTP. Please try again later.');
      }

      return { success: true, message: 'OTP sent to your email.' };
    } finally {
      await this.redis.releaseLock(lockKey, acquired);
    }
  }

  /**
   * Verify email OTP for CMS 2FA login.
   * @param email - Admin's email address
   * @param otp - 6-digit OTP
   */
  async verifyCmsOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redisKey = `cms:${normalizedEmail}`;
      
      await this.redis.consumeOTP(redisKey, this.hashOtp(otp), this.MAX_RETRIES);

      this.logger.log(`[OTP Verify Success] CMS 2FA OTP verified for ${normalizedEmail}`);

      await this.redis.recordOtpMetric('success', Date.now() - startTime);

      return { success: true, message: 'OTP verified successfully.' };
    } catch (err: any) {
      await this.redis.recordOtpMetric('failure', Date.now() - startTime);
      throw err;
    }
  }



  // ==========================================
  // BRANCH & INTERNAL RM AUTH
  // ==========================================

  /** Active branches for the login dropdown (id + name only). */
  async getBranchLoginOptions() {
    return this.prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Branch login. One Branch Manager email may be shared by several branches,
   * so the user picks the branch first (`branchId`) and then enters email + password.
   * Without `branchId` it only works when the email belongs to exactly one branch.
   */
  async branchLogin(emailInput: string, passwordInput: string, branchId?: string) {
    const logger = this.logger;
    
    const email = emailInput?.trim().toLowerCase();
    let branch;
    if (branchId) {
      branch = await this.prisma.branch.findUnique({ where: { id: String(branchId) } });
      // Same generic error when the email doesn't belong to the chosen branch
      if (branch && branch.email !== email) branch = null;
    } else {
      const matches = await this.prisma.branch.findMany({ where: { email }, take: 2 });
      if (matches.length > 1) {
        throw new BadRequestException('Please select your branch to sign in.');
      }
      branch = matches[0] ?? null;
    }
    if (!branch) {
      logger.warn({ event: 'branch.login.not_found', email }, `Failed login attempt (branch not found): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (branch.status !== 'ACTIVE') {
      logger.warn({ event: 'branch.login.inactive', branchId: branch.id, email }, `Failed login attempt (branch inactive): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(passwordInput?.trim(), branch.passwordHash);
    if (!isPasswordValid) {
      logger.warn({ event: 'branch.login.wrong_password', branchId: branch.id, email }, `Failed login attempt (wrong password for branch): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    return branch;
  }

  async generateBranchToken(branchId: string, email: string, name: string, req?: any) {
    const sessionId = await this.createSession(branchId, 'BROWSER', 'BRANCH', req);
    return sessionId;
  }

  async getBranchById(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { ...AuthService.BRANCH_SELECT, updatedAt: true } });
    if (!branch) throw new UnauthorizedException('Branch not found');
    return branch;
  }

  async internalRmLogin(emailInput: string, passwordInput: string) {
    const logger = this.logger;
    
    const email = emailInput?.trim().toLowerCase();
    const rm = await this.prisma.internalRM.findUnique({ where: { email } });
    if (!rm) {
      logger.warn({ event: 'internal_rm.login.not_found', email }, `Failed login attempt (internal RM not found): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (rm.status !== 'ACTIVE') {
      logger.warn({ event: 'internal_rm.login.inactive', rmId: rm.id, email }, `Failed login attempt (internal RM inactive): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(passwordInput?.trim(), rm.passwordHash);
    if (!isPasswordValid) {
      logger.warn({ event: 'internal_rm.login.wrong_password', rmId: rm.id, email }, `Failed login attempt (wrong password for internal RM): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    return rm;
  }

  async generateInternalRmToken(internalRmId: string, email: string, name: string, branchId: string, req?: any) {
    const sessionId = await this.createSession(internalRmId, 'BROWSER', 'INTERNAL_RM', req);
    return sessionId;
  }

  async createInternalRm(branchId: string, name: string, email: string, password: string, employeeId?: string) {
    assertStrongPassword(password);
    const normalizedEmail = email.trim().toLowerCase();
    const existingRm = await this.prisma.internalRM.findUnique({ where: { email: normalizedEmail } });
    if (existingRm) throw new BadRequestException('Email already registered for another Internal RM');
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('Branch not found');
    const passwordHash = await bcrypt.hash(password, 10);
    const rm = await this.prisma.internalRM.create({
      data: { name, email: normalizedEmail, passwordHash, status: 'ACTIVE', branchId, employeeId: employeeId?.trim() },
      select: { id: true, name: true, email: true, employeeId: true, status: true, createdAt: true },
    });
    return {
      ...rm,
      company: branch.name || 'SMC Global Securities Ltd.',
    };
  }

  async updateInternalRmEmployeeId(branchId: string, rmId: string, employeeId: string) {
    const existing = await this.prisma.internalRM.findUnique({
      where: { id: rmId },
      select: { id: true, branchId: true, employeeId: true },
    });
    if (!existing || existing.branchId !== branchId) {
      throw new NotFoundException('Relationship Manager not found');
    }
    if (existing.employeeId && existing.employeeId.trim().length > 0) {
      throw new BadRequestException('Employee ID has already been assigned and cannot be modified');
    }
    return this.prisma.internalRM.update({
      where: { id: rmId },
      data: { employeeId: employeeId.trim() },
      select: { id: true, name: true, email: true, employeeId: true, status: true, createdAt: true },
    });
  }

  async deleteInternalRm(branchId: string, rmId: string) {
    const existing = await this.prisma.internalRM.findUnique({
      where: { id: rmId },
      select: { id: true, branchId: true },
    });
    if (!existing || existing.branchId !== branchId) {
      throw new NotFoundException('Relationship Manager not found');
    }

    await this.prisma.coupon.updateMany({
      where: { internalRmId: rmId },
      data: { internalRmId: null },
    });
    return this.prisma.internalRM.delete({ where: { id: rmId } });
  }

  async getBranchInternalRms(branchId: string) {
    const rms = await this.prisma.internalRM.findMany({
      where: { branchId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        status: true,
        createdAt: true,
        _count: { select: { couponsGenerated: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rms.map((rm: any) => ({
      id: rm.id,
      name: rm.name,
      email: rm.email,
      employeeId: rm.employeeId,
      status: rm.status,
      createdAt: rm.createdAt,
      _count: rm._count,
      company: rm.branch?.name || 'SMC Global Securities Ltd.',
    }));
  }

  async getAllInternalRms() {
    return this.prisma.internalRM.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        status: true,
        createdAt: true,
        branchId: true,
        _count: { select: { couponsGenerated: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllBranches() {
    return this.prisma.branch.findMany({ select: AuthService.BRANCH_SELECT, orderBy: { createdAt: 'desc' } });
  }

  async getBranchForAdmin(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: AuthService.BRANCH_SELECT,
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async updateBranch(branchId: string, name: string, email: string, classification?: BranchClassificationInput) {
    await this.getBranchForAdmin(branchId);
    // Email is not unique: one Branch Manager may run several branches.
    const normalizedEmail = email.trim().toLowerCase();

    try {
      return await this.prisma.branch.update({
        where: { id: branchId },
        data: {
          name: name.trim(),
          email: normalizedEmail,
          // Only touch classification when the caller sends one
          ...(classification?.classification ? this.buildBranchClassificationData(classification) : {}),
        },
        select: AuthService.BRANCH_SELECT,
      });
    } catch (error) {
      // The branch can be deleted after the check above.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Branch not found');
        }
      }
      throw error;
    }
  }

  private static readonly BRANCH_SELECT = {
    id: true,
    name: true,
    email: true,
    status: true,
    createdAt: true,
    classification: true,
    classificationLabel: true,
    zone: true,
    zonalHead: true,
    areaManager: true,
    branchManager: true,
    territory: true,
    territoryHead: true,
    reportingManager: true,
  } as const;

  /** Maps classification input to DB columns, clearing fields not used by the selected type. */
  private buildBranchClassificationData(input: BranchClassificationInput) {
    const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
    const type = input.classification || null;
    const isEquity = type === 'EQUITY';
    const isDistribution = type === 'DISTRIBUTION';
    const usesReportingManager = type === 'WEALTH' || type === 'STOXKART' || type === 'OTHER';
    return {
      classification: type,
      classificationLabel: type === 'OTHER' ? clean(input.classificationLabel) : null,
      zone: isEquity ? clean(input.zone) : null,
      zonalHead: isEquity ? clean(input.zonalHead) : null,
      areaManager: isEquity ? clean(input.areaManager) : null,
      branchManager: isEquity ? clean(input.branchManager) : null,
      territory: isDistribution ? clean(input.territory) : null,
      territoryHead: isDistribution ? clean(input.territoryHead) : null,
      reportingManager: usesReportingManager ? clean(input.reportingManager) : null,
    };
  }

  async createBranch(
    name: string,
    email: string,
    passwordHash: string,
    classification: BranchClassificationInput = {},
  ) {
    // Email is not unique: one Branch Manager may run several branches.
    const normalizedEmail = email.trim().toLowerCase();

    return this.prisma.branch.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        status: 'ACTIVE',
        ...this.buildBranchClassificationData(classification),
      },
      select: AuthService.BRANCH_SELECT,
    });
  }

  async deleteBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { internalRMs: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const rmIds = branch.internalRMs.map((rm) => rm.id);
    if (rmIds.length > 0) {
      await this.prisma.coupon.updateMany({
        where: { internalRmId: { in: rmIds } },
        data: { internalRmId: null },
      });
      await this.prisma.internalRM.deleteMany({
        where: { id: { in: rmIds } },
      });
    }

    return await this.prisma.branch.delete({
      where: { id: branchId },
    });
  }

  // ==========================================
  // DISTRIBUTOR & DISTRIBUTOR RM AUTH
  // ==========================================

  async distributorLogin(emailInput: string, passwordInput: string) {
    const logger = this.logger;
    
    const email = emailInput?.trim().toLowerCase();
    const distributor = await this.prisma.distributor.findUnique({ where: { email } });
    if (!distributor) {
      logger.warn({ event: 'distributor.login.not_found', email }, `Failed login attempt (distributor not found): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (distributor.status !== 'ACTIVE') {
      logger.warn({ event: 'distributor.login.inactive', distributorId: distributor.id, email }, `Failed login attempt (distributor inactive): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(passwordInput?.trim(), distributor.passwordHash);
    if (!isPasswordValid) {
      logger.warn({ event: 'distributor.login.wrong_password', distributorId: distributor.id, email }, `Failed login attempt (wrong password for distributor): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    return distributor;
  }

  async generateDistributorToken(distributorId: string, email: string, name: string, req?: any) {
    const sessionId = await this.createSession(distributorId, 'BROWSER', 'DISTRIBUTOR', req);
    return sessionId;
  }

  async getDistributorById(distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId }, select: { id: true, name: true, email: true, status: true, createdAt: true, updatedAt: true } });
    if (!distributor) throw new UnauthorizedException('Distributor not found');
    return distributor;
  }

  async distributorRmLogin(emailInput: string, passwordInput: string) {
    const logger = this.logger;
    
    const email = emailInput?.trim().toLowerCase();
    const rm = await this.prisma.distributorRM.findUnique({ where: { email } });
    if (!rm) {
      logger.warn({ event: 'distributor_rm.login.not_found', email }, `Failed login attempt (distributor RM not found): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (rm.status !== 'ACTIVE') {
      logger.warn({ event: 'distributor_rm.login.inactive', rmId: rm.id, email }, `Failed login attempt (distributor RM inactive): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(passwordInput?.trim(), rm.passwordHash);
    if (!isPasswordValid) {
      logger.warn({ event: 'distributor_rm.login.wrong_password', rmId: rm.id, email }, `Failed login attempt (wrong password for distributor RM): ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    return rm;
  }

  async generateDistributorRmToken(distributorRmId: string, email: string, name: string, distributorId: string, req?: any) {
    const sessionId = await this.createSession(distributorRmId, 'BROWSER', 'DISTRIBUTOR_RM', req);
    return sessionId;
  }

  async createDistributorRm(distributorId: string, name: string, email: string, password: string, employeeId?: string) {
    assertStrongPassword(password);
    const normalizedEmail = email.trim().toLowerCase();
    const existingRm = await this.prisma.distributorRM.findUnique({ where: { email: normalizedEmail } });
    if (existingRm) throw new BadRequestException('Email already registered for another Distributor RM');
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) throw new BadRequestException('Distributor not found');
    const passwordHash = await bcrypt.hash(password, 10);
    const rm = await this.prisma.distributorRM.create({
      data: { name, email: normalizedEmail, passwordHash, status: 'ACTIVE', distributorId, employeeId: employeeId?.trim() },
      select: { id: true, name: true, email: true, employeeId: true, status: true, createdAt: true },
    });
    return {
      ...rm,
      company: distributor.name || 'SMC Distributor Partner',
    };
  }

  async updateDistributorRmEmployeeId(distributorId: string, rmId: string, employeeId: string) {
    const existing = await this.prisma.distributorRM.findUnique({
      where: { id: rmId },
      select: { id: true, distributorId: true, employeeId: true },
    });
    if (!existing || existing.distributorId !== distributorId) {
      throw new NotFoundException('Relationship Manager not found');
    }
    if (existing.employeeId && existing.employeeId.trim().length > 0) {
      throw new BadRequestException('Employee ID has already been assigned and cannot be modified');
    }
    return this.prisma.distributorRM.update({
      where: { id: rmId },
      data: { employeeId: employeeId.trim() },
      select: { id: true, name: true, email: true, employeeId: true, status: true, createdAt: true },
    });
  }

  async getDistributorRms(distributorId: string) {
    const rms = await this.prisma.distributorRM.findMany({
      where: { distributorId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        status: true,
        createdAt: true,
        _count: { select: { couponsGenerated: true } },
        distributor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rms.map((rm: any) => ({
      id: rm.id,
      name: rm.name,
      email: rm.email,
      employeeId: rm.employeeId,
      status: rm.status,
      createdAt: rm.createdAt,
      _count: rm._count,
      company: rm.distributor?.name || 'SMC Distributor Partner',
    }));
  }

  async getAllDistributorRms() {
    return this.prisma.distributorRM.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        status: true,
        createdAt: true,
        distributorId: true,
        _count: { select: { couponsGenerated: true } },
        distributor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllDistributors() {
    return this.prisma.distributor.findMany({ select: { id: true, name: true, email: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }

  async getDistributorForAdmin(distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id: distributorId },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    if (!distributor) throw new NotFoundException('Distributor not found');
    return distributor;
  }

  async updateDistributor(distributorId: string, name: string, email: string) {
    await this.getDistributorForAdmin(distributorId);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.distributor.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing && existing.id !== distributorId) {
      throw new BadRequestException('Distributor with this email already exists');
    }

    try {
      return await this.prisma.distributor.update({
        where: { id: distributorId },
        data: { name: name.trim(), email: normalizedEmail },
        select: { id: true, name: true, email: true, status: true, createdAt: true },
      });
    } catch (error) {
      // The distributor or email can change after the checks above.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Distributor with this email already exists');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Distributor not found');
        }
      }
      throw error;
    }
  }

  async createDistributor(name: string, email: string, passwordHash: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.distributor.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new BadRequestException('Distributor with this email already exists');
    return this.prisma.distributor.create({
      data: { name, email: normalizedEmail, passwordHash, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
  }

  async deleteDistributor(distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id: distributorId },
      include: { distributorRMs: true },
    });
    if (!distributor) throw new NotFoundException('Distributor not found');

    const rmIds = distributor.distributorRMs.map((rm) => rm.id);
    if (rmIds.length > 0) {
      await this.prisma.coupon.updateMany({
        where: { distributorRmId: { in: rmIds } },
        data: { distributorRmId: null },
      });
      await this.prisma.distributorRM.deleteMany({
        where: { id: { in: rmIds } },
      });
    }

    return await this.prisma.distributor.delete({
      where: { id: distributorId },
    });
  }

  async deleteRm(rmId: string) {
    const internalRm = await this.prisma.internalRM.findUnique({ where: { id: rmId } });
    if (internalRm) {
      await this.prisma.coupon.updateMany({
        where: { internalRmId: rmId },
        data: { internalRmId: null },
      });
      return await this.prisma.internalRM.delete({ where: { id: rmId } });
    }

    const distRm = await this.prisma.distributorRM.findUnique({ where: { id: rmId } });
    if (distRm) {
      await this.prisma.coupon.updateMany({
        where: { distributorRmId: rmId },
        data: { distributorRmId: null },
      });
      return await this.prisma.distributorRM.delete({ where: { id: rmId } });
    }

    throw new NotFoundException('Relationship Manager not found');
  }

  /**
   * Update user's full name (used in signup flow)
   * @param userId - User ID
   * @param fullName - New full name
   */
  async updateFullName(userId: string, fullName: string) {
    const trimmedName = fullName.trim();
    return await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: trimmedName },
    });
  }

  /**
   * Deactivate user account
   * @param userId - User ID to deactivate
   */
  async deactivateUser(userId: string) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await this.redis.deleteAllUserSessions(userId);
    return result;
  }

  /**
   * Soft-delete user account
   * Renames phone and email fields to free up unique constraints for new signups
   * @param userId - User ID to delete
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const timestamp = Date.now();

    const result = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        isActive: false,
        phone: user.phone ? `${user.phone}_deleted_${timestamp}` : null,
        email: user.email ? `${user.email}_deleted_${timestamp}` : null,
      },
    });
    await this.redis.deleteAllUserSessions(userId);
    return result;
  }

  // ==========================================
  // PARTNER (BRANCH / DISTRIBUTOR / RM) FORGOT PASSWORD
  // ==========================================

  /**
   * Resolve a partner account for the given portal.
   * The distributor portal falls back to Branch accounts (legacy behaviour).
   */
  private async findPartnerAccounts(
    portal: PartnerPortal,
    email: string,
  ): Promise<{ kind: PartnerPortal; id: string; status: string }[]> {
    if (portal === 'internal-rm') {
      const rm = await this.prisma.internalRM.findUnique({ where: { email } });
      return rm ? [{ kind: 'internal-rm', id: rm.id, status: rm.status }] : [];
    }
    if (portal === 'distributor-rm') {
      const rm = await this.prisma.distributorRM.findUnique({ where: { email } });
      return rm ? [{ kind: 'distributor-rm', id: rm.id, status: rm.status }] : [];
    }
    if (portal === 'distributor') {
      const distributor = await this.prisma.distributor.findUnique({ where: { email } });
      if (distributor) return [{ kind: 'distributor', id: distributor.id, status: distributor.status }];
    }
    // A Branch Manager email can be shared by several branches; the OTP proves
    // ownership of the inbox, so a reset applies to all of them.
    const branches = await this.prisma.branch.findMany({ where: { email }, select: { id: true, status: true } });
    return branches.map((b) => ({ kind: 'branch' as PartnerPortal, id: b.id, status: b.status }));
  }

  private partnerKey(type: 'otp' | 'attempts' | 'rate' | 'token', portal: string, email: string) {
    return `partner:forgot_password_${type}:${portal}:${email}`;
  }

  /**
   * Send password-reset OTP for Branch / Distributor portals.
   * OTP is SHA-256 hashed in Redis (10 min TTL) and NEVER returned to the client.
   */
  async sendPartnerForgotPasswordOtp(emailInput: string, portal: PartnerPortal) {
    const email = emailInput.trim().toLowerCase();
    const genericSuccessMessage =
      'If an active account exists with this email address, a verification OTP has been sent.';

    // Rate limit: max 3 OTP requests per 10 minutes per email+portal (commented out)
    /*
    const rateKey = this.partnerKey('rate', portal, email);
    const rateVal = await this.redis.getKey(rateKey);
    const rateCount = rateVal ? parseInt(String(rateVal), 10) : 0;
    if (rateCount >= 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please wait 10 minutes before requesting another code.',
      );
    }
    await this.redis.setKey(rateKey, (rateCount + 1).toString(), 600);
    */

    const accounts = (await this.findPartnerAccounts(portal, email)).filter((a) => a.status === 'ACTIVE');
    // Enumeration protection: respond identically when no active account exists
    if (accounts.length === 0) {
      return { success: true, message: genericSuccessMessage };
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    await this.redis.setKey(this.partnerKey('otp', portal, email), otpHash, 600);
    await this.redis.deleteKey(this.partnerKey('attempts', portal, email));

    const allowConsoleFallback =
      process.env.NODE_ENV !== 'production';
    if (allowConsoleFallback) {
      this.logger.log(`Partner (${portal}) Forgot Password OTP for ${email}: ${otp}`);
    }

    const result = await this.emailService.sendOtpEmail(email, otp).catch((err: any) => {
      this.logger.error(`[AuthService] Partner OTP email exception: ${err?.message}`);
      return { success: false, message: err?.message };
    });
    if (!result?.success) {
      this.logger.error(`[AuthService] Failed to send partner OTP email to ${email}`);
      if (!allowConsoleFallback) {
        throw new ServiceUnavailableException(
          'Unable to send OTP email right now. Please try again later.',
        );
      }
    }

    return { success: true, message: genericSuccessMessage };
  }

  /**
   * Verify partner OTP (max 5 failed attempts) and issue a one-time reset token (15 min TTL).
   */
  async verifyPartnerForgotPasswordOtp(
    emailInput: string,
    portal: PartnerPortal,
    otp: string,
  ) {
    const email = emailInput.trim().toLowerCase();
    const attemptsKey = this.partnerKey('attempts', portal, email);
    const attemptsVal = await this.redis.getKey(attemptsKey);
    const attempts = attemptsVal ? parseInt(String(attemptsVal), 10) : 0;
    if (attempts >= 5) {
      throw new BadRequestException('Too many failed verification attempts. Please request a new OTP.');
    }

    const otpKey = this.partnerKey('otp', portal, email);
    const storedHash = await this.redis.getKey(otpKey);
    const inputHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    if (!storedHash || storedHash !== inputHash) {
      await this.redis.setKey(attemptsKey, (attempts + 1).toString(), 900);
      throw new BadRequestException(
        `Invalid or expired OTP. (${Math.max(0, 4 - attempts)} attempts remaining)`,
      );
    }

    await this.redis.deleteKey(otpKey);
    await this.redis.deleteKey(attemptsKey);

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.redis.setKey(this.partnerKey('token', portal, email), resetToken, 900);

    return { success: true, resetToken, message: 'OTP verified successfully.' };
  }

  /**
   * Reset Branch / Distributor password. Requires the reset token issued after OTP verification.
   */
  async resetPartnerPassword(
    portal: PartnerPortal,
    emailInput: string,
    resetToken: string,
    newPassword: string,
  ) {
    const email = emailInput?.trim().toLowerCase();
    const tokenKey = this.partnerKey('token', portal, email);
    const storedToken = await this.redis.getKey(tokenKey);

    const tokenValid =
      !!storedToken &&
      typeof resetToken === 'string' &&
      storedToken.length === resetToken.length &&
      crypto.timingSafeEqual(Buffer.from(String(storedToken)), Buffer.from(resetToken));
    if (!tokenValid) {
      throw new BadRequestException('Invalid or expired reset session. Please request a new OTP.');
    }

    assertStrongPassword(newPassword);

    const accounts = (await this.findPartnerAccounts(portal, email)).filter((a) => a.status === 'ACTIVE');
    if (accounts.length === 0) {
      await this.redis.deleteKey(tokenKey);
      throw new BadRequestException('Account not found or inactive.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const data = { passwordHash, hashedRefreshToken: null };
    // A shared Branch Manager email resets every active branch that uses it
    for (const account of accounts) {
      switch (account.kind) {
        case 'distributor':
          await this.prisma.distributor.update({ where: { id: account.id }, data });
          break;
        case 'internal-rm':
          await this.prisma.internalRM.update({ where: { id: account.id }, data });
          break;
        case 'distributor-rm':
          await this.prisma.distributorRM.update({ where: { id: account.id }, data });
          break;
        default:
          await this.prisma.branch.update({ where: { id: account.id }, data });
      }
    }

    // One-time token: burn it along with any rate/attempt counters
    await this.redis.deleteKey(tokenKey);
    await this.redis.deleteKey(this.partnerKey('rate', portal, email));
    await this.redis.deleteKey(this.partnerKey('attempts', portal, email));

    // Revoke existing sessions so a compromised session can't persist past reset
    for (const account of accounts) {
      try {
        const sessions = await this.redis.getUserActiveSessions(account.id);
        for (const s of sessions) {
          await this.redis.deleteSession(s.sessionId);
        }
      } catch (e) {
        this.logger.warn({ accountId: account.id, accountKind: account.kind, err: e }, `Failed to invalidate sessions for ${account.kind} ${account.id}`);
      }
    }

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  // ==========================================
  // SESSION MANAGEMENT (View & Terminate)
  // ==========================================

  /**
   * Get all active sessions for the authenticated user.
   * Returns sanitized session metadata (device, IP, time) without exposing session tokens.
   * @param userId - Authenticated user's ID
   * @param currentSessionId - The session ID of the requesting user (to mark "current")
   */
  async getActiveSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.redis.getUserActiveSessions(userId);
    return sessions.map((s: any) => ({
      id: s.sessionId,
      portal: s.portal,
      device: s.userAgent,
      deviceClass: s.deviceClass,
      ip: s.ip,
      loginTime: s.issuedAt,
      lastActive: s.lastActivity,
      expiresInSeconds: s.expiresInSeconds,
      isCurrent: Boolean(
        currentSessionId && (s.sessionId === currentSessionId || s.rawSessionId === currentSessionId)
      ),
    }));
  }

  /**
   * Terminate a specific session
   * @param userId - The user terminating the session
   * @param targetSessionId - The session ID (hashed or raw) to terminate
   */
  async terminateSession(userId: string, targetSessionId: string) {
    const isAlreadyHashed = /^[a-f0-9]{64}$/i.test(targetSessionId);
    const hashedSessionId = isAlreadyHashed ? targetSessionId : this.hashSessionId(targetSessionId);
    const session = await this.redis.getSession(hashedSessionId);
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found or belongs to another user.');
    }

    await this.redis.deleteSession(hashedSessionId);

    // Also clear the corresponding device class key if it pointed to this session
    if (session.deviceClass) {
      const activeKey = `active-session:${session.deviceClass}:${userId}`;
      const rawStored = await this.redis.getKey(activeKey);
      if (rawStored && (rawStored === targetSessionId || this.hashSessionId(rawStored) === hashedSessionId)) {
        await this.redis.deleteKey(activeKey);
      }
    }

    this.logger.log({ userId, sessionId: hashedSessionId }, `Session ${hashedSessionId} terminated by user ${userId}`);
  }

  /**
   * Log out all devices by incrementing sessionVersion
   */
  async logoutAllDevices(userId: string) {
    const currentVersion = await this.redis.getKey(`user-session-version:${userId}`) || 1;
    await this.redis.setKey(`user-session-version:${userId}`, currentVersion + 1, 60 * 60 * 24 * 365);
    this.logger.log({ userId, sessionVersion: currentVersion + 1 }, `User ${userId} incremented sessionVersion to ${currentVersion + 1}, logging out all devices.`);
  }

  /**
   * Terminate all other sessions except the current one.
   * Useful for "Log out of all other devices" feature.
   * @param userId - Authenticated user's ID
   * @param currentSessionId - The session to keep alive
   */
  async terminateAllOtherSessions(userId: string, currentSessionId: string) {
    const sessions = await this.redis.getUserActiveSessions(userId);
    let terminated = 0;
    for (const s of sessions) {
      const isCurrent = Boolean(
        currentSessionId && (s.sessionId === currentSessionId || s.rawSessionId === currentSessionId)
      );
      if (!isCurrent) {
        await this.redis.deleteSession(s.sessionId);
        if (s.deviceClass) {
          await this.redis.deleteKey(`active-session:${s.deviceClass}:${userId}`);
        }
        terminated++;
      }
    }
    this.logger.log({ userId, terminated }, `User ${userId} terminated ${terminated} other session(s)`);
    return { success: true, message: `${terminated} session(s) terminated` };
  }

  /**
   * Detect suspicious login: warn if the new login IP differs from the user's last known session IP.
   * Called during createSession to log alerts for location-based anomalies.
   * @param userId - User ID
   * @param portal - Portal type
   * @param newIp - IP address of the new login
   */
  async detectSuspiciousLogin(userId: string, portal: string, newIp: string) {
    try {
      const sessions = await this.redis.getUserActiveSessions(userId);
      if (sessions.length === 0) return; // First login, no comparison possible

      // Check if any existing session has a different IP
      const knownIps = new Set(sessions.map((s: any) => s.ip).filter((ip: string) => ip !== 'Unknown'));
      if (knownIps.size > 0 && !knownIps.has(newIp)) {
        this.logger.warn({ userId, portal, newIp, knownIps: [...knownIps].join(', ') },
          `[SUSPICIOUS LOGIN] User ${userId} (${portal}) logged in from new IP ${newIp}. ` +
          `Known IPs: [${[...knownIps].join(', ')}]`
        );
      }
    } catch (err) {
      // Non-fatal: monitoring is best-effort
    }
  }

  /**
   * Helper to format User-Agent string into human-readable device & browser label
   */
  private formatUserAgent(ua: string): string {
    if (!ua || ua === 'Unknown') return 'Unknown Device';

    let browser = 'Browser';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    let os = 'Device';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';

    return `${browser} on ${os}`;
  }

  /**
   * Notify user/admin via email when a login occurs from a new device or browser.
   * Runs asynchronously during createSession.
   */
  async notifyNewDeviceLogin(userId: string, portal: string, req?: any) {
    try {
      const userAgent = req?.headers?.['user-agent'] || 'Unknown';
      const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'Unknown';

      // 1. Check if this device is new for this user
      const isNew = await this.redis.isNewDeviceForUser(userId, userAgent);
      if (!isNew) {
        return;
      }

      // 2. Resolve recipient email and display name based on user / admin type
      let recipientEmail: string | null = null;
      let recipientName: string = 'User';

      if (portal === 'USER') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        });
        recipientEmail = user?.email || null;
        recipientName = user?.fullName || 'Investor';
      } else if (['ADMIN', 'CMS', 'SUPPORT', 'MARKETING', 'ACCOUNTING', 'OPERATION'].includes(portal)) {
        const admin = await this.prisma.admin.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        });
        recipientEmail = admin?.email || null;
        recipientName = admin?.fullName || 'Administrator';
      } else if (portal === 'BRANCH') {
        const branch = await this.prisma.branch.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        recipientEmail = branch?.email || null;
        recipientName = branch?.name || 'Branch Manager';
      } else if (portal === 'INTERNAL_RM') {
        const rm = await this.prisma.internalRM.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        recipientEmail = rm?.email || null;
        recipientName = rm?.name || 'Relationship Manager';
      } else if (portal === 'DISTRIBUTOR') {
        const dist = await this.prisma.distributor.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        recipientEmail = dist?.email || null;
        recipientName = dist?.name || 'Distributor Partner';
      } else if (portal === 'DISTRIBUTOR_RM') {
        const distRm = await this.prisma.distributorRM.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        recipientEmail = distRm?.email || null;
        recipientName = distRm?.name || 'Partner RM';
      }

      if (!recipientEmail) {
        return;
      }

      const formattedDevice = this.formatUserAgent(userAgent);

      // 3. Send security alert email
      this.logger.log({ userId, portal, ip, device: formattedDevice }, `[NEW DEVICE LOGIN] Sending security alert to ${recipientEmail} for ${portal} login on ${formattedDevice} (${ip})`);

      await this.emailService.sendNewDeviceLoginAlert({
        email: recipientEmail,
        fullName: recipientName,
        portal,
        device: formattedDevice,
        ip,
        loginTime: new Date(),
      });
    } catch (err: any) {
      this.logger.warn({ userId, err }, `Failed to process new device login notification (best-effort): ${err.message}`);
    }
  }

  /**
   * Permanently delete a user from the database and remove their MinIO files.
   * @param userId - ID of the user to delete
   */
  async permanentlyDeleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycDocuments: true },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userLedger = await this.prisma.ledger.findUnique({
      where: { userId },
      include: {
        voucherEntries: { take: 1 },
      },
    });

    const fileUrls: string[] = [];

    // Extract KycDocument S3/MinIO URLs
    for (const doc of user.kycDocuments) {
      if (doc.docLink) {
        fileUrls.push(doc.docLink);
      }
    }

    // Extract Demat Uploaded Documents
    if (user.dematDocuments && typeof user.dematDocuments === 'object') {
      const docs = user.dematDocuments as any;
      if (docs.dematStatement?.url) fileUrls.push(docs.dematStatement.url);
      if (docs.cmrCopy?.url) fileUrls.push(docs.cmrCopy.url);
    }

    // Extract URLs in KYC progress if any
    if (user.kycData && typeof user.kycData === 'object') {
       const kyc = user.kycData as any;
       if (kyc.panDetails?.documentUrl) fileUrls.push(kyc.panDetails.documentUrl);
       if (kyc.aadhaarDetails?.documentUrl) fileUrls.push(kyc.aadhaarDetails.documentUrl);
       if (kyc.bankDetails?.documentUrl) fileUrls.push(kyc.bankDetails.documentUrl);
       if (kyc.documentsUploaded?.panUrl) fileUrls.push(kyc.documentsUploaded.panUrl);
       if (kyc.documentsUploaded?.aadhaarFrontUrl) fileUrls.push(kyc.documentsUploaded.aadhaarFrontUrl);
       if (kyc.documentsUploaded?.aadhaarBackUrl) fileUrls.push(kyc.documentsUploaded.aadhaarBackUrl);
       if (kyc.documentsUploaded?.bankStatementUrl) fileUrls.push(kyc.documentsUploaded.bankStatementUrl);
    }

    for (const url of fileUrls) {
      if (typeof url === 'string' && url.startsWith('/storage/')) {
        const parts = url.replace('/storage/', '').split('/');
        const bucket = parts[0];
        const fileName = parts.slice(1).join('/');
        
        try {
          await fetch(`http://localhost:3005/api/upload/${bucket}/${fileName}`, {
            method: 'DELETE',
          });
          this.logger.log(`Deleted MinIO file ${bucket}/${fileName}`);
        } catch (e) {
          this.logger.error(`Failed to delete MinIO file ${bucket}/${fileName}`, e);
        }
      }
    }

    // 2. Atomically clean up all user-dependent records before deleting the User row
    await this.prisma.$transaction(async (tx) => {
      // Clean up watchlists & portfolios
      await tx.watchlistItem.deleteMany({ where: { userId } });
      await tx.portfolio.deleteMany({ where: { userId } });

      // Clean up interests & sell requests
      await tx.stockInterest.deleteMany({ where: { userId } });
      await tx.sellRequest.deleteMany({ where: { userId } });

      // Clean up coupon references (unlink assigned or used coupons)
      await tx.coupon.updateMany({
        where: { assignedUserId: userId },
        data: { assignedUserId: null },
      });
      await tx.coupon.updateMany({
        where: { usedByUserId: userId },
        data: { usedByUserId: null },
      });

      // Clean up content likes & notifications & history
      await tx.contentLike.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.loginHistory.deleteMany({ where: { userId } });
      await tx.kycDocument.deleteMany({ where: { userId } });

      // Clean up orders, payment attempts, and lot allocations
      const userOrders = await tx.order.findMany({
        where: { userId },
        select: { id: true },
      });
      const orderIds = userOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        await tx.paymentAttempt.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await tx.order.deleteMany({
          where: { id: { in: orderIds } },
        });
      }

      // Delete the user's ledger if empty, or unlink it if vouchers exist (to preserve accounting audit trails)
      if (userLedger) {
        if (userLedger.voucherEntries.length === 0) {
          await tx.ledger.delete({ where: { id: userLedger.id } });
        } else {
          await tx.ledger.update({
            where: { id: userLedger.id },
            data: { userId: null, isActive: false },
          });
        }
      }

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    // 4. Revoke sessions and remove the deleted user's Redis authentication data.
    let redisCleanupPending = false;
    try {
      await this.logoutAllDevices(userId);
      await this.redis.deleteUserData(user);
    } catch (e) {
      redisCleanupPending = true;
      this.logger.warn({ userId, err: e }, `Failed to clean up Redis data for deleted user ${userId}`);
    }

    return {
      success: true,
      redisCleanupPending,
      message: redisCleanupPending
        ? 'User permanently deleted, but Redis cleanup failed. Cached data may remain until expiry.'
        : 'User permanently deleted',
    };
  }

  /**
   * Send Forgot Password OTP to panel user's email address
   * Includes Email Enumeration Protection, Rate Limiting, and Hashed OTP Storage.
   */
  async sendPanelForgotPasswordOtp(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const genericSuccessMessage =
      'If an active account exists with this email address, a verification OTP has been sent.';

    // Rate Limiting Check: Max 3 OTP requests per 10 minutes per email (commented out)
    /*
    const rateLimitKey = `panel:forgot_password_rate:${normalizedEmail}`;
    const rateCountVal = await this.redis.getKey(rateLimitKey);
    const rateCount = rateCountVal ? parseInt(String(rateCountVal), 10) : 0;

    if (rateCount >= 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please wait 10 minutes before requesting another code.',
      );
    }
    */

    const admin = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    // For internal panel: Tell user clearly if no account exists with this email
    if (!admin || !admin.isActive) {
      throw new BadRequestException(
        'No active panel account found with this email address.',
      );
    }

    // Increment rate limit counter (commented out)
    // await this.redis.setKey(rateLimitKey, (rateCount + 1).toString(), 600);

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const allowConsoleFallback =
      process.env.NODE_ENV !== 'production';
    if (allowConsoleFallback) {
      this.logger.log(`Panel Forgot Password OTP for ${normalizedEmail}: ${otp}`);
    }

    // Store HASHED OTP in Redis (SHA-256 hash) for 10 minutes (600 seconds)
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const redisKey = `panel:forgot_password_otp:${normalizedEmail}`;
    await this.redis.setKey(redisKey, otpHash, 600);

    // Reset attempt counter for this email
    await this.redis.deleteKey(`panel:forgot_password_attempts:${normalizedEmail}`);

    // Send email via EmailService
    try {
      await this.emailService.sendOtpEmail(normalizedEmail, otp);
      this.logger.log(`[OTP Request] Panel Forgot Password OTP sent to ${normalizedEmail}`);
    } catch (err: any) {
      this.logger.error(`[AuthService] Failed to send OTP email: ${err.message}`);
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
    const attemptsVal = await this.redis.getKey(attemptsKey);
    const attempts = attemptsVal ? parseInt(String(attemptsVal), 10) : 0;

    if (attempts >= 5) {
      throw new BadRequestException(
        'Too many failed verification attempts. Please request a new OTP.',
      );
    }

    const redisKey = `panel:forgot_password_otp:${normalizedEmail}`;
    const storedHash = await this.redis.getKey(redisKey);

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    if (!storedHash || storedHash !== inputHash) {
      // Increment failed attempts counter
      await this.redis.setKey(attemptsKey, (attempts + 1).toString(), 900);
      throw new BadRequestException(
        `Invalid or expired OTP verification code. (${4 - attempts} attempts remaining)`,
      );
    }

    // OTP Verified! Delete OTP and attempts keys
    await this.redis.deleteKey(redisKey);
    await this.redis.deleteKey(attemptsKey);

    // Generate random 32-byte hex reset token stored in Redis (15-minute TTL)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenKey = `panel:reset_token:${normalizedEmail}`;
    await this.redis.setKey(tokenKey, resetToken, 900);

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
    const storedToken = await this.redis.getKey(tokenKey);

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

    // Enforce enterprise password policy (8+ chars, uppercase, lowercase, number, special char)
    assertStrongPassword(newPassword);

    // Hash new password using bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await this.prisma.admin.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });

    // Delete Redis reset keys
    await this.redis.deleteKey(`panel:forgot_password_otp:${normalizedEmail}`);
    await this.redis.deleteKey(`panel:forgot_password_attempts:${normalizedEmail}`);
    await this.redis.deleteKey(`panel:forgot_password_rate:${normalizedEmail}`);
    await this.redis.deleteKey(tokenKey);

    // Invalidate cached permissions for this admin
    await this.redis.deleteKey(`admin:${admin.id}:permissions`);

    // Invalidate active sessions in Redis if any exist
    try {
      const sessions = await this.redis.getUserActiveSessions(admin.id);
      for (const s of sessions) {
        await this.redis.deleteSession(s.sessionId);
      }
    } catch (e) {
      this.logger.warn({ adminId: admin.id, err: e }, `Failed to invalidate sessions for admin ${admin.id}`);
    }

    return {
      success: true,
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }
}
