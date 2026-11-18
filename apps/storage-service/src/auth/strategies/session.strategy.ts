import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { RedisService } from '../../redis/redis.service';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto';
import * as crypto from 'crypto';
import { PinoNestLogger } from '@smc/logger';

@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new PinoNestLogger('storage-service', 'SessionStrategy');

  constructor(private readonly redisService: RedisService) {
    super();
  }

  async validate(req: any): Promise<any> {
    let sessionId: string | null = null;

    const authHeader = req.headers?.['authorization'] || req.raw?.headers?.['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    } else {
      const cookies = req.cookies || {};
      
      sessionId =
        cookies[OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.AUTH_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.MARKETING_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
        cookies[ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN] ||
        cookies[OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN];
    }

    if (!sessionId) {
      throw new UnauthorizedException('No session provided');
    }

    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    const session = await this.redisService.get(`session:${hashedSessionId}`);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      userId: session.userId,
      type: session.type,
      deviceClass: session.deviceClass,
      sessionId: hashedSessionId,
    };
  }
}