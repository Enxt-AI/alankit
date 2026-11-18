import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  decryptTokenSafe,
  OBFUSCATED_COOKIE_NAMES,
  ORIGINAL_COOKIE_NAMES,
} from 'cookie-crypto';

/**
 * JWT Strategy for storage-service
 * Validates JWT tokens issued by auth-service
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static encryptionKey: string;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    const cookieEncryptionKey = configService.get<string>(
      'COOKIE_ENCRYPTION_KEY',
    );

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    JwtStrategy.encryptionKey = cookieEncryptionKey || '';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          // Try Authorization header first (Bearer token)
          const authHeader = request.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
          }

          // Try all obfuscated cookies
          for (const key of Object.keys(OBFUSCATED_COOKIE_NAMES)) {
            const cookieName =
              OBFUSCATED_COOKIE_NAMES[
                key as keyof typeof OBFUSCATED_COOKIE_NAMES
              ];
            const token = decryptTokenSafe(
              request.cookies?.[cookieName],
              JwtStrategy.encryptionKey,
            );
            if (token) return token;
          }

          // Try all original cookies
          for (const key of Object.keys(ORIGINAL_COOKIE_NAMES)) {
            const cookieName =
              ORIGINAL_COOKIE_NAMES[key as keyof typeof ORIGINAL_COOKIE_NAMES];
            const token = decryptTokenSafe(
              request.cookies?.[cookieName],
              JwtStrategy.encryptionKey,
            );
            if (token) return token;
          }

          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (payload.type === 'ADMIN') {
      if (!payload.adminId || !payload.email) {
        throw new UnauthorizedException('Invalid admin token');
      }
      return {
        adminId: payload.adminId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        type: 'ADMIN',
      };
    }

    if (!payload.userId || !payload.email) {
      throw new UnauthorizedException('Invalid user token');
    }

    return {
      userId: payload.userId,
      email: payload.email,
      type: 'USER',
    };
  }
}
