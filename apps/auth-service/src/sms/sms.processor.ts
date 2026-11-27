import { Process, Processor } from '@nestjs/bull';
import * as Bull from 'bull';
import { SmsService } from './sms.service';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';
import { PinoNestLogger } from '@/logger';

const service = 'auth-service';
const ctx = 'SmsProcessor';

@Processor('sms')
export class SmsProcessor {
  private readonly logger = new PinoNestLogger(service, ctx);

  constructor(
    private readonly smsService: SmsService,
    private readonly redis: RedisService,
  ) {}

  @Process('sendOtp')
  async handleSendOtp(
    job: Bull.Job<{ phone: string; otp: string; expiresAt?: number }>,
  ) {
    const { phone, otp } = job.data;
    const hash = createHash('sha256').update(otp).digest('hex');
    const record = await this.redis.getOTP(phone);
    if (
      !record ||
      record.otp !== hash ||
      !record.expiresAt ||
      record.expiresAt <= Date.now()
    )
      return;
    const maskedPhone = `******${phone.slice(-4)}`;
    this.logger.log(
      `Processing background sendOtp job for phone: ${maskedPhone}`,
    );
    try {
      const result = await this.smsService.sendOtpSmsSync(phone, otp);
      if (!result.success) throw new Error('SMS provider rejected the message');
      await this.redis
        .updateOtpDelivery(phone, hash, 'accepted')
        .catch((error) => {
          this.logger.warn(`Could not record SMS acceptance: ${error.message}`);
        });
      this.logger.log(
        `Successfully completed sendOtp job for phone: ${maskedPhone}`,
      );
    } catch (err: any) {
      this.logger.error(
        { event: 'sms.delivery.failed', phone: maskedPhone, err },
        `Failed to send OTP to ${maskedPhone} inside queue processor: ${err.message}`,
      );
      await this.redis
        .updateOtpDelivery(
          phone,
          hash,
          job.attemptsMade + 1 >= (job.opts.attempts || 1)
            ? 'failed'
            : 'retrying',
        )
        .catch((error) => {
          this.logger.warn(`Could not record SMS failure: ${error.message}`);
        });
      throw err;
    }
  }
}
