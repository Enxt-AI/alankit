import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { RedisService } from '../../redis/redis.service';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';
import { PinoNestLogger } from '@smc/logger';

@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new PinoNestLogger('auth-service', 'SessionStrategy');

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async validate(req: Request): Promise<any> {
    // Prevent double execution if both GlobalJwtAuthGuard and JwtAuthGuard run
    if ((req as any).dpopValidated && (req as any).userPayload) {
      return (req as any).userPayload;
    }

    // 1. Extract session ID from Bearer token or cookie
    let sessionId: string | null = null;
    
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    } else if (req.cookies) {
      // The old strategy allowed falling back to different cookies depending on context
      // For opaque session IDs, we assume the token is in the AUTH_TOKEN or ADMIN_PANEL_TOKEN etc.
      // We will check the context like the previous strategy to extract the right cookie.
      const url = (req.url || '').toLowerCase();
      const origin = (req.headers?.origin || '').toLowerCase();
      const referer = (req.headers?.referer || '').toLowerCase();
      const panelContextHeader = (req.headers?.['x-panel-context'] as string || '').toLowerCase();

      const resolveContext = (panelName: string, pathSignatures: string[]) => {
        if (panelContextHeader === panelName) return true;
        if (referer.includes(`/${panelName}/`) || referer.endsWith(`/${panelName}`)) return true;
        return pathSignatures.some(sig => url.includes(sig));
      };

      const isCmsContext = resolveContext('cms', ['/auth/cms/']);
      const isSupportContext = resolveContext('support', ['/auth/support/']);
      const isMarketingContext = resolveContext('marketing', ['/auth/marketing/']);
      const isAccountingContext = resolveContext('accounting', ['/auth/accounting/']);
      const isOperationContext = resolveContext('operation', ['/auth/operation/']);
      const isAdminContext = resolveContext('admin', ['/auth/admin/', '/tokens/admin/']);
      const isDistributorContext = resolveContext('distributor', ['/auth/distributor/', '/tokens/distributor/']);
      const isRmContext = resolveContext('rm', ['/auth/rm/', '/tokens/rm/']);
      const isBranchContext = resolveContext('branch', ['/auth/branch/', '/tokens/branch/']);

      if (isBranchContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN];
      else if (isDistributorContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN];
      else if (isRmContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN];
      else if (isAccountingContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isOperationContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isCmsContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isSupportContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isMarketingContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.MARKETING_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isAdminContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.AUTH_TOKEN];

      if (!sessionId) {
        sessionId =
          req.cookies[OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN] ||
          req.cookies[OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN] ||
          req.cookies[ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
          req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
          req.cookies[ORIGINAL_COOKIE_NAMES.AUTH_TOKEN];
      }
    }

    if (!sessionId) {
      throw new UnauthorizedException('No session provided');
    }

    // 2. Hash session ID and lookup in Redis
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    const session = await this.redisService.getSession(hashedSessionId);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // 3. Verify device fingerprint to prevent cookie hijacking
    const currentFingerprint = req.headers['x-device-fingerprint'] || null;
    if (session.deviceFingerprint && currentFingerprint && session.deviceFingerprint !== currentFingerprint) {
      SessionStrategy.logger.warn({ userId: session.userId, sessionId: hashedSessionId }, `Device fingerprint mismatch for session ${hashedSessionId}`);
      throw new UnauthorizedException('Device fingerprint mismatch');
    }

    // 4. DPoP Proof of Possession Verification
    if (session.publicKey) {
      const dpopProof = req.headers['x-dpop-proof'] as string;
      const dpopTimestamp = req.headers['x-dpop-timestamp'] as string;
      const dpopJti = req.headers['x-dpop-jti'] as string;

      SessionStrategy.logger.debug({ userId: session.userId, sessionId: hashedSessionId, dpopPresent: !!dpopProof, dpopTimestamp, dpopJti }, `[DPoP] proof=${dpopProof ? 'present' : 'missing'}, ts=${dpopTimestamp}, jti=${dpopJti}, session=${hashedSessionId}`);

      if (!dpopProof || !dpopTimestamp || !dpopJti) {
        throw new UnauthorizedException('Missing DPoP proof headers');
      }

      // Replay prevention: Check timestamp window (±30s)
      const now = Date.now();
      const ts = parseInt(dpopTimestamp, 10);
      if (isNaN(ts) || Math.abs(now - ts) > 120000) {
        throw new UnauthorizedException(`DPoP timestamp out of acceptable window (server: ${now}, client: ${ts})`);
      }

      // Replay prevention: Ensure JTI is not reused within the window (using Redis SET NX)
      const replayKey = `dpop:${hashedSessionId}:${dpopJti}`;
      const acquired = await this.redisService.acquireLock(replayKey, 60);
      if (!acquired) {
        throw new UnauthorizedException('DPoP replay detected');
      }

      // Canonical Path Reconstruction
      const rawUrl = req.originalUrl || req.url || '';
      const canonicalPath = rawUrl.split('?')[0];
      const method = (req.method || 'GET').toUpperCase();
      
      // Request Body Hashing
      let bodyHash = '';
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
      }

      const payload = `${method} ${canonicalPath} ${dpopTimestamp} ${dpopJti} ${bodyHash}`;
      
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(payload);
        
        // Base64 decode the proof back to a buffer
        const signatureBuffer = Buffer.from(dpopProof, 'base64');

        // WebCrypto ECDSA outputs IEEE-P1363 (r || s). Node defaults to DER.
        // We must specify dsaEncoding: 'ieee-p1363'.
        const isValid = verify.verify(
          {
            key: Buffer.from(session.publicKey, 'base64'),
            format: 'der',
            type: 'spki',
            dsaEncoding: 'ieee-p1363',
          },
          signatureBuffer
        );

        if (!isValid) {
          throw new UnauthorizedException('Invalid DPoP signature');
        }
      } catch (err: any) {
        SessionStrategy.logger.error({ userId: session.userId, sessionId: hashedSessionId, err }, `DPoP verification failed: ${err.message}`);
        throw new UnauthorizedException('DPoP verification failed');
      }
    }

    // 5. Check if sessionVersion is still valid (Global Logout)
    const currentSessionVersion = await this.redisService.getKey(`user-session-version:${session.userId}`);
    if (currentSessionVersion && session.sessionVersion < currentSessionVersion) {
      // This session was created before the user logged out of all devices
      await this.redisService.deleteSession(hashedSessionId);
      throw new UnauthorizedException('Session revoked by global logout');
    }
    
    // 6. Idle-timeout enforcement (BROWSER only)
    // Mobile (APK) sessions stay alive indefinitely so the app never
    // auto-logs out.  Browser sessions expire after 10 min of inactivity.
    if (session.deviceClass === 'BROWSER' && session.lastActivity) {
      const idleSec = (Date.now() - session.lastActivity) / 1000;
      const IDLE_LIMIT = 600; // 10 minutes — matches AuthService.IDLE_TIMEOUT_SECONDS
      if (idleSec > IDLE_LIMIT) {
        await this.redisService.deleteSession(hashedSessionId);
        SessionStrategy.logger.warn({ userId: session.userId, sessionId: hashedSessionId, idleSec: Math.round(idleSec) },
          `Browser session ${hashedSessionId} expired after ${Math.round(idleSec)}s idle`,
        );
        throw new UnauthorizedException('Session expired due to inactivity');
      }
    }

    // 7. Slide the idle-timeout window by updating lastActivity (fire-and-forget).
    //    For APK sessions we still track it but it's never enforced.
    session.lastActivity = Date.now();
    const remainingTtl = await this.redisService.getSessionTtl(hashedSessionId);
    if (remainingTtl > 0) {
      this.redisService.setSession(hashedSessionId, session, remainingTtl).catch(() => {});
    }

    // Check if account is still active for users
    if (!session.type || session.type === 'USER') {
      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (user && (!user.isActive || user.isDeleted)) {
        await this.redisService.deleteSession(hashedSessionId);
        throw new UnauthorizedException('Account deactivated or deleted');
      }
    }

    // Return session context as req.user
    const userPayload: any = {
      userId: session.userId,
      deviceClass: session.deviceClass,
      type: session.type || 'USER',
      sessionId: hashedSessionId,
      stepUpVerifiedAt: session.stepUpVerifiedAt,
    };

    if (userPayload.type === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({ where: { id: session.userId } });
      if (!admin || !admin.isActive) {
        await this.redisService.deleteSession(hashedSessionId);
        throw new UnauthorizedException('Admin account deactivated or not found');
      }
      userPayload.adminId = admin.id;
      userPayload.email = admin.email;
      userPayload.role = admin.role;
      userPayload.permissions = admin.permissions;
    } else if (userPayload.type === 'DISTRIBUTOR') {
      userPayload.distributorId = session.userId;
    } else if (userPayload.type === 'DISTRIBUTOR_RM') {
      userPayload.distributorRmId = session.userId;
    } else if (userPayload.type === 'INTERNAL_RM') {
      userPayload.internalRmId = session.userId;
    } else if (userPayload.type === 'BRANCH') {
      userPayload.branchId = session.userId;
    }

    // Cache the result to prevent double-execution
    (req as any).dpopValidated = true;
    (req as any).userPayload = userPayload;

    return userPayload;
  }
}
