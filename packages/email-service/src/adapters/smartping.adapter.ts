import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class SmartPingEmailProvider implements EmailProvider {
  readonly providerName = 'smartping';
  private readonly logger = new Logger(SmartPingEmailProvider.name);

  private get endpoint(): string {
    return (
      process.env.SMARTPING_ENDPOINT ||
      'https://1eqrmn.apiemail.smartping.io/email/4/messages'
    );
  }

  constructor() {
    const apiKey = process.env.SMARTPING_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'SMARTPING_API_KEY is not set. SmartPing email delivery will likely fail.',
      );
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const apiKey = process.env.SMARTPING_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: new Error('SMARTPING_API_KEY is not set'),
      };
    }

    const body = {
      messages: [
        {
          sender: options.from,
          destinations: options.to.map((recipient) => ({
            to: [{ destination: recipient }],
          })),
          content: {
            subject: options.subject,
            html: options.html,
          },
        },
      ],
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `App ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (response.status !== 200) {
        return {
          success: false,
          error: new Error(
            `SmartPing API error ${response.status}: ${JSON.stringify(data)}`,
          ),
        };
      }

      const messageId = data?.messages?.[0]?.messageId;
      return {
        success: true,
        messageId,
      };
    } catch (err) {
      return { success: false, error: err };
    }
  }
}
