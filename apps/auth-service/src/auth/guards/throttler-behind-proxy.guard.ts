import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that handles requests behind proxy servers (like Nginx)
 * and isolates rate limits per request payload (phone/email) or client IP.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Resolve target phone or email from request body for isolation
    const phone = req.body?.phone || req.body?.mobile;
    if (phone && typeof phone === 'string') {
      const sanitizedPhone = phone.replace(/\D/g, ''); // Extract only digits for consistency
      return `phone:${sanitizedPhone}`;
    }

    const email = req.body?.email;
    if (email && typeof email === 'string') {
      return `email:${email.toLowerCase().trim()}`;
    }

    // 2. Fallback to client IP resolving correctly behind reverse proxies
    const rawXForwardedFor = req.headers['x-forwarded-for'];
    if (rawXForwardedFor) {
      const firstIp = Array.isArray(rawXForwardedFor)
        ? rawXForwardedFor[0]
        : rawXForwardedFor.split(',')[0];
      if (firstIp) {
        return firstIp.trim();
      }
    }

    if (req.ips && req.ips.length > 0) {
      return req.ips[0];
    }

    return req.ip || '';
  }
}
