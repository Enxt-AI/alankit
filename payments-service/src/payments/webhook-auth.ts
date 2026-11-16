import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export function authenticateWebhook(rawBody: Buffer | undefined, signature: string, timestamp: string, secret: string) {
  if (!rawBody || !secret || !signature || !timestamp) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  const expected = createHmac('sha256', secret).update(timestamp).update(rawBody).digest('base64');
  const actual = Buffer.from(signature);
  const valid = Buffer.from(expected);
  if (actual.length !== valid.length || !timingSafeEqual(actual, valid)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  // Exclude delivery timestamp: redelivery of the same event keeps the same job ID.
  return createHash('sha256').update(rawBody).digest('hex');
}
