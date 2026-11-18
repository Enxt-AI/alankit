import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly providerName = 'resend';
  private readonly resend: Resend;
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY is not set. Email delivery will likely fail.',
      );
    }
    this.resend = new Resend(apiKey);
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { data, error } = await this.resend.emails.send(
      {
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined,
    );

    if (error) {
      return { success: false, error };
    }

    return { success: true, messageId: data?.id };
  }
}
