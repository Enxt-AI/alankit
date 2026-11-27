import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';
import { redis } from 'redis-service';
import { PinoNestLogger } from '@/logger';

/**
 * Result returned by the SMS gateway after attempting to send a message.
 */
export interface SmsResult {
  success: boolean;
  ackid?: string;
  msgid?: string;
  errorCode?: string;
  errorDesc?: string;
}

/**
 * SmsService handles outbound OTP delivery via the VoiceSMS gateway.
 */
const service = 'auth-service';
const ctx = 'SmsService';

@Injectable()
export class SmsService {
  private readonly logger = new PinoNestLogger(service, ctx);

  private readonly gatewayUrl: string;
  private readonly ukey: string;
  private readonly senderId: string;
  private readonly templateId: string;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('sms') private readonly smsQueue: any,
  ) {
    this.gatewayUrl =
      process.env.VOICESMS_GATEWAY_URL ||
      'http://125.16.147.178/VoicenSMS/webresources/CreateSMSCampaignGet';
    this.ukey = process.env.VOICESMS_UKEY || '';
    this.senderId = process.env.VOICESMS_SENDER_ID || 'ALKIMG';
    this.templateId = process.env.VOICESMS_TEMPLATE_ID || '0';

    if (!this.ukey || !this.senderId || !this.templateId) {
      this.logger.warn(
        'VoiceSMS configuration is incomplete. Ensure VOICESMS_UKEY is set in the environment.',
      );
    }
  }

  /**
   * Queue the OTP SMS sending task asynchronously.
   * Falls back to synchronous sending if the queue operations fail.
   */
  async sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
    try {
      this.logger.log(
        `Queuing OTP SMS job for phone: ${phone.length > 4 ? `******${phone.slice(-4)}` : phone}`,
      );
      await this.smsQueue.add(
        'sendOtp',
        { phone, otp, expiresAt: Date.now() + 300000 },
        {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: true,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
      return { success: true, ackid: 'QUEUED' };
    } catch (err: any) {
      this.logger.error(`Failed to queue SMS job: ${err.message}`);
      this.logger.warn(
        `Attempting synchronous SMS sending fallback due to queue failure`,
      );
      return await this.sendOtpSmsSync(phone, otp);
    }
  }

  /**
   * Synchronously send an OTP SMS with automatic retries via VoiceSMS.
   */
  async sendOtpSmsSync(phone: string, otp: string): Promise<SmsResult> {
    const message = `Dear User, ${otp} is the OTP for login. Team Alankit.`;
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: any = null;

    const maskedPhone = phone.length > 4 ? `******${phone.slice(-4)}` : phone;

    // Check if circuit breaker is tripped
    let isPrimaryTripped = false;
    try {
      isPrimaryTripped = !!(await redis.get('circuit:sms:primary:tripped'));
    } catch (err: any) {
      this.logger.warn(
        `Failed to check circuit breaker status in Redis: ${err.message}`,
      );
    }

    if (isPrimaryTripped) {
      this.logger.warn(
        `[Circuit Breaker] Primary SMS gateway is TRIPPED. Unable to send SMS for ${maskedPhone}`,
      );
      throw new ServiceUnavailableException(
        'SMS gateway temporarily unavailable. Please try again later.',
      );
    }

    while (attempt < maxAttempts) {
      attempt++;
      this.logger.log(
        `Attempt ${attempt} of ${maxAttempts} to send SMS to ${maskedPhone} via VoiceSMS`,
      );
      try {
        const result = await this.sendViaVoiceSmsGateway(phone, message);
        if (result.success) {
          // Success: reset failures
          try {
            await redis.del('circuit:sms:primary:failures');
          } catch {}
          return result;
        }

        // Fast-fail: If credit is exhausted, skip attempts immediately
        if (result.errorCode === '015') {
          this.logger.warn(
            `VoiceSMS credit exhausted (code 015) for ${maskedPhone}. Skipping retries.`,
          );
          lastError = new Error('VoiceSMS: Insufficient credit.');
          break;
        }

        lastError = new Error(
          `VoiceSMS business error: ${result.errorCode} - ${result.errorDesc}`,
        );
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `VoiceSMS attempt ${attempt} failed for ${maskedPhone}: ${err.message}`,
        );
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    // VoiceSMS failed: record failure and increment counter
    try {
      const failures = await redis.incr('circuit:sms:primary:failures');
      if (failures === 1) {
        await redis.expire('circuit:sms:primary:failures', 600); // 10 minutes window
      }
      if (failures >= 5) {
        this.logger.error(
          `[Circuit Breaker] Consecutive failures reached ${failures}. Tripping circuit breaker for primary SMS gateway (5 minutes).`,
        );
        await redis.set('circuit:sms:primary:tripped', 'true', 'EX', 300); // Trip for 5 minutes
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to update circuit breaker state in Redis: ${err.message}`,
      );
    }

    this.logger.error(
      `SMS gateway failed to send SMS to ${maskedPhone}: ${lastError?.message}`,
    );
    throw new ServiceUnavailableException(
      'Unable to send OTP. Please try again later.',
    );
  }

  /**
   * Internal helper to make the HTTP request to the VoiceSMS gateway.
   */
  private async sendViaVoiceSmsGateway(
    phone: string,
    message: string,
  ): Promise<SmsResult> {
    const params = new URLSearchParams({
      ukey: this.ukey,
      msisdn: phone,
      language: '0',
      credittype: '7',
      senderid: this.senderId,
      templateid: this.templateId,
      message,
      filetype: '2',
    });

    const url = `${this.gatewayUrl}?${params.toString()}`;

    const response = await firstValueFrom(
      this.httpService.get(url, { timeout: 10000 }),
    );

    const data = response.data;

    if (typeof data === 'string') {
      return this.parseVoiceSmsResponse(data);
    }

    if (data?.data?.ackid || data?.data?.ack_id) {
      const ackid = data.data.ackid || data.data.ack_id;
      return {
        success: true,
        ackid,
        msgid: Array.isArray(data.data.msgid)
          ? data.data.msgid.join(', ')
          : data.data.msgid,
      };
    }

    if (data?.Error || data?.error) {
      const error = data.Error || data.error;
      const errorCode =
        error.ErrorCode || error.errorCode || error.code || 'UNKNOWN';
      const errorDesc =
        error.ErrorDesc ||
        error.errorDesc ||
        error.message ||
        'Unknown gateway error';
      return {
        success: false,
        errorCode,
        errorDesc: this.mapGatewayError(errorCode, errorDesc),
      };
    }

    const ackid =
      data?.ackid ||
      data?.ack_id ||
      data?.campaignid ||
      data?.campaign_id ||
      data?.requestid ||
      data?.id;
    if (
      ackid ||
      data?.success === true ||
      String(data?.status || '').toLowerCase() === 'success'
    ) {
      return { success: true, ackid: ackid ? String(ackid) : undefined };
    }
    return {
      success: false,
      errorCode: 'UNEXPECTED',
      errorDesc: 'Unexpected response from VoiceSMS gateway',
    };
  }

  private parseVoiceSmsResponse(response: string): SmsResult {
    const trimmed = response.trim();
    if (!trimmed)
      return {
        success: false,
        errorCode: 'EMPTY',
        errorDesc: 'Empty response from VoiceSMS gateway',
      };
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.Error || parsed?.error) {
        const error = parsed.Error || parsed.error;
        return {
          success: false,
          errorCode:
            error.ErrorCode || error.errorCode || error.code || 'UNKNOWN',
          errorDesc:
            error.ErrorDesc ||
            error.errorDesc ||
            error.message ||
            'VoiceSMS rejected the request',
        };
      }
      const ackid =
        parsed?.ackid ||
        parsed?.ack_id ||
        parsed?.campaignid ||
        parsed?.campaign_id ||
        parsed?.requestid ||
        parsed?.id;
      if (
        ackid ||
        parsed?.success === true ||
        String(parsed?.status || '').toLowerCase() === 'success'
      ) {
        return { success: true, ackid: ackid ? String(ackid) : trimmed };
      }
      return {
        success: false,
        errorCode: 'UNEXPECTED',
        errorDesc: 'VoiceSMS returned an unrecognized response',
      };
    } catch {
      if (/<ack_id>|<ackid>/i.test(trimmed))
        return this.parseXmlResponse(trimmed, '');
      if (/error|failed|invalid|insufficient/i.test(trimmed)) {
        return {
          success: false,
          errorCode: 'REJECTED',
          errorDesc: trimmed.slice(0, 200),
        };
      }
      return { success: true, ackid: trimmed.slice(0, 200) };
    }
  }

  /**
   * Parse an XML response string from the SMS gateway.
   */
  private parseXmlResponse(xml: string, phone: string): SmsResult {
    const ackIdMatch =
      xml.match(/<ack_id>(.*?)<\/ack_id>/i) ||
      xml.match(/<ackid>(.*?)<\/ackid>/i);
    const msgIdMatch = xml.match(/<msgid>(.*?)<\/msgid>/i);

    if (ackIdMatch) {
      const ackid = ackIdMatch[1].trim();
      const msgid = msgIdMatch ? msgIdMatch[1].trim() : undefined;
      return {
        success: true,
        ackid,
        msgid,
      };
    }

    const errorCodeMatch = xml.match(/<ErrorCode>(.*?)<\/ErrorCode>/i);
    const errorDescMatch = xml.match(/<ErrorDesc>(.*?)<\/ErrorDesc>/i);

    if (errorCodeMatch) {
      const errorCode = errorCodeMatch[1].trim();
      const errorDesc = errorDescMatch
        ? errorDescMatch[1].trim()
        : 'Unknown gateway error';
      return {
        success: false,
        errorCode,
        errorDesc: this.mapGatewayError(errorCode, errorDesc),
      };
    }

    return {
      success: false,
      errorCode: 'UNEXPECTED',
      errorDesc: 'Unexpected XML response from SMS gateway',
    };
  }

  /**
   * Map gateway error codes to user-friendly descriptions.
   */
  private mapGatewayError(code: string, fallback: string): string {
    const errorMap: Record<string, string> = {
      '010': 'Sender ID length/format error',
      '011': 'Mobile number (MSISDN) length/format error',
      '015': 'Insufficient SMS credit — contact SMS provider',
      '103': 'Message content is empty',
      '104': 'Message coding error',
      '105': 'Schedule time format error',
    };

    return errorMap[code] || fallback;
  }
}
