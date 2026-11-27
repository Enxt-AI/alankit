import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { RedisService } from '../../redis/redis.service';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PinoNestLogger } from '@/logger';

@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new PinoNestLogger('payments-service', 'SessionStrategy');

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async validate(req: any): Promise<any> {
    let sessionId: string | null = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    } else if (req.cookies) {
      const url = (req.url || '').toLowerCase();
      const referer = (req.headers?.referer || '').toLowerCase();
      const panelContextHeader = req.headers?.['x-panel-context']?.toLowerCase();

      const resolveContext = (panelName: string, pathSignatures: string[]) => {
        if (panelContextHeader === panelName) return true;
        if (referer.includes(`/${panelName}/`) || referer.endsWith(`/${panelName}`)) return true;
        return pathSignatures.some(sig => url.includes(sig));
      };

      const isCmsContext = resolveContext('cms', ['/cms']);
      const isSupportContext = resolveContext('support', ['/support']);
      const isMarketingContext = resolveContext('marketing', ['/marketing']);
      const isAccountingContext = resolveContext('accounting', ['/accounting']);
      const isOperationContext = resolveContext('operation', ['/operation']);
      const isAdminContext = resolveContext('admin', ['/admin']);
      const isDistributorContext = resolveContext('distributor', ['/distributor']);
      const isRmContext = resolveContext('rm', ['/rm', '/internal-rm']) && !isDistributorContext;
      const isBranchContext = resolveContext('branch', ['/branch']);

      if (isBranchContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN];
      else if (isDistributorContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN];
      else if (isRmContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN] || req.cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN];
      else if (isAdminContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN];
      else if (isCmsContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN];
      else if (isSupportContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN];
      else if (isMarketingContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.MARKETING_PANEL_TOKEN];
      else if (isAccountingContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN];
      else if (isOperationContext) sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN];
      else sessionId = req.cookies[OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN] || req.cookies[ORIGINAL_COOKIE_NAMES.AUTH_TOKEN];
    }

    if (!sessionId) {
      throw new UnauthorizedException('No session provided');
    }

    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    const session = await this.redisService.get(`session:${hashedSessionId}`);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const currentFingerprint = req.headers['x-device-fingerprint'] || null;
    if (session.deviceFingerprint && currentFingerprint && session.deviceFingerprint !== currentFingerprint) {
      SessionStrategy.logger.warn({ userId: session.userId, sessionId: hashedSessionId }, `Device fingerprint mismatch for session ${hashedSessionId}`);
      throw new UnauthorizedException('Device fingerprint mismatch');
    }

    const userPayload: any = {
      userId: session.userId,
      type: session.type,
      deviceClass: session.deviceClass,
      sessionId: hashedSessionId,
      stepUpVerifiedAt: session.stepUpVerifiedAt,
    };

    const ADMIN_PORTAL_TYPES = ['ADMIN', 'CMS', 'SUPPORT', 'MARKETING', 'ACCOUNTING', 'OPERATION', 'OPERATIONS'];

    if (ADMIN_PORTAL_TYPES.includes(session.type) && session.userId) {
      const admin = await this.prisma.admin.findUnique({
        where: { id: session.userId }
      });

      if (admin) {
        if (!admin.isActive) {
           throw new UnauthorizedException('Admin account deactivated');
        }
        userPayload.adminId = session.userId;
        userPayload.email = admin.email;
        userPayload.fullName = admin.fullName;
        userPayload.role = admin.role;
        userPayload.permissions = admin.permissions;
      }
    } else if (session.type === 'DISTRIBUTOR') {
      userPayload.distributorId = session.userId;
    } else if (session.type === 'DISTRIBUTOR_RM') {
      userPayload.distributorRmId = session.userId;
    } else if (session.type === 'INTERNAL_RM') {
      userPayload.internalRmId = session.userId;
    } else if (session.type === 'BRANCH') {
      userPayload.branchId = session.userId;
    }

    return userPayload;
  }
}