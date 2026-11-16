import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';
import { redis } from 'redis-service';
import { PinoNestLogger } from '@smc/logger';

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
 * SmsService handles all outbound SMS delivery via the SMC SMS Gateway.
 */
const service = 'auth-service';
const ctx = 'SmsService';

@Injectable()
export class SmsService {
  private readonly logger = new PinoNestLogger(service, ctx);

  private readonly gatewayUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly senderId: string;
  private readonly peId: string;
  private readonly templateId: string;

  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('sms') private readonly smsQueue: any,
  ) {
    this.gatewayUrl =
      process.env.SMS_GATEWAY_URL ||
      'https://web.smsgw.in/smsapi/httpapi.jsp';
    this.username = process.env.SMS_GATEWAY_USERNAME || '';
    this.password = process.env.SMS_GATEWAY_PASSWORD || '';
    this.senderId = process.env.SMS_SENDER_ID || '';
    this.peId = process.env.SMS_PE_ID || '';
    this.templateId = process.env.SMS_TEMPLATE_ID || '';


    if (!this.username || !this.password || !this.senderId || !this.peId || !this.templateId) {
      this.logger.warn(
        'SMS Gateway configuration is incomplete. ' +
        'Ensure SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD, SMS_SENDER_ID, ' +
        'SMS_PE_ID, and SMS_TEMPLATE_ID are set in the environment.',
      );
    }
  }

  /**
   * Queue the OTP SMS sending task asynchronously.
   * Falls back to synchronous sending if the queue operations fail.
   */
  async sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
    try {
      this.logger.log(`Queuing OTP SMS job for phone: ${phone.length > 4 ? `******${phone.slice(-4)}` : phone}`);
      await this.smsQueue.add('sendOtp', { phone, otp, expiresAt: Date.now() + 300000 }, {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
      return { success: true, ackid: 'QUEUED' };
    } catch (err: any) {
      this.logger.error(`Failed to queue SMS job: ${err.message}`);
      this.logger.warn(`Attempting synchronous SMS sending fallback due to queue failure`);
      return await this.sendOtpSmsSync(phone, otp);
    }
  }

  /**
   * Synchronously send an OTP SMS with automatic retries via SMC SMS Gateway.
   */
  async sendOtpSmsSync(phone: string, otp: string): Promise<SmsResult> {
    // DO NOT EDIT: must match the DLT-registered template (SMS_TEMPLATE_ID) character for character.
    // Any change makes telecom operators silently drop the SMS even though the gateway returns an ack.
    // To change the wording, register a new template on DLT first and update SMS_TEMPLATE_ID.
    const message = `UnlistedStox Login OTP: ${otp}. Valid for 10 minutes only. Never share your OTP.`;
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: any = null;

    const maskedPhone = phone.length > 4 ? `******${phone.slice(-4)}` : phone;

    // Check if circuit breaker is tripped
    let isPrimaryTripped = false;
    try {
      isPrimaryTripped = !!(await redis.get('circuit:sms:primary:tripped'));
    } catch (err: any) {
      this.logger.warn(`Failed to check circuit breaker status in Redis: ${err.message}`);
    }

    if (isPrimaryTripped) {
      this.logger.warn(`[Circuit Breaker] Primary SMS gateway is TRIPPED. Unable to send SMS for ${maskedPhone}`);
      throw new ServiceUnavailableException('SMS gateway temporarily unavailable. Please try again later.');
    }

    while (attempt < maxAttempts) {
      attempt++;
      this.logger.log(`Attempt ${attempt} of ${maxAttempts} to send SMS to ${maskedPhone} via primary gateway`);
      try {
        const result = await this.sendViaPrimaryGateway(phone, message);
        if (result.success) {
          // Success: reset failures
          try {
            await redis.del('circuit:sms:primary:failures');
          } catch {}
          return result;
        }

        // Fast-fail: If credit is exhausted, skip attempts immediately
        if (result.errorCode === '015') {
          this.logger.warn(`Primary gateway credit exhausted (code 015) for ${maskedPhone}. Skipping primary retries.`);
          lastError = new Error('SMC Gateway: Insufficient credit.');
          break;
        }

        lastError = new Error(`Primary gateway business error: ${result.errorCode} - ${result.errorDesc}`);
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`Primary gateway attempt ${attempt} failed with network error for ${maskedPhone}: ${err.message}`);
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    // Primary gateway failed: record failure and increment counter
    try {
      const failures = await redis.incr('circuit:sms:primary:failures');
      if (failures === 1) {
        await redis.expire('circuit:sms:primary:failures', 600); // 10 minutes window
      }
      if (failures >= 5) {
        this.logger.error(`[Circuit Breaker] Consecutive failures reached ${failures}. Tripping circuit breaker for primary SMS gateway (5 minutes).`);
        await redis.set('circuit:sms:primary:tripped', 'true', 'EX', 300); // Trip for 5 minutes
      }
    } catch (err: any) {
      this.logger.warn(`Failed to update circuit breaker state in Redis: ${err.message}`);
    }

    this.logger.error(`SMS gateway failed to send SMS to ${maskedPhone}: ${lastError?.message}`);
    throw new ServiceUnavailableException(
      'Unable to send OTP. Please try again later.'
    );
  }

  /**
   * Internal helper to make the HTTP request to the SMC SMS Gateway.
   */
  private async sendViaPrimaryGateway(phone: string, message: string): Promise<SmsResult> {
    const params = new URLSearchParams({
      username: this.username,
      password: this.password,
      from: this.senderId,
      to: phone,
      text: message,
      pe_id: this.peId,
      template_id: this.templateId,
      responsetype: 'json',
    });

    const url = `${this.gatewayUrl}?${params.toString()}`;

    const response = await firstValueFrom(
      this.httpService.get(url),
    );

    const data = response.data;

    if (typeof data === 'string') {
      return this.parseXmlResponse(data, phone);
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

    if (data?.Error) {
      const errorCode = data.Error.ErrorCode || 'UNKNOWN';
      const errorDesc = data.Error.ErrorDesc || 'Unknown gateway error';
      return {
        success: false,
        errorCode,
        errorDesc: this.mapGatewayError(errorCode, errorDesc),
      };
    }

    return {
      success: false,
      errorCode: 'UNEXPECTED',
      errorDesc: 'Unexpected response from SMS gateway',
    };
  }

  /**
   * Parse an XML response string from the SMS gateway.
   */
  private parseXmlResponse(xml: string, phone: string): SmsResult {
    const ackIdMatch = xml.match(/<ack_id>(.*?)<\/ack_id>/i) ||
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
