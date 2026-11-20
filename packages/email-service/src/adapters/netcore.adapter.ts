import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';

interface NetcoreAddress {
  email: string;
  name?: string;
}

type NetcoreResponse = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

@Injectable()
export class NetcoreEmailProvider implements EmailProvider {
  readonly providerName = 'netcore';
  private readonly logger = new Logger(NetcoreEmailProvider.name);

  private get endpoint(): string {
    return (
      process.env.NETCORE_ENDPOINT ||
      'https://emailapi.netcorecloud.net/v5/mail/send'
    );
  }

  constructor() {
    if (!process.env.NETCORE_API_KEY) {
      this.logger.warn(
        'NETCORE_API_KEY is not set. Netcore email delivery will fail until it is configured.',
      );
    }
  }

  /** Converts "Name <email@domain.com>" (or a bare address) into Netcore's address object. */
  private parseAddress(value: string): NetcoreAddress {
    const raw = value.trim();
    const match = raw.match(/^(?:"([^"]*)"|([^<>]*?))?\s*<([^<>]+)>$/);

    if (match) {
      const email = match[3]?.trim();
      if (!email) return { email: raw };

      const name = (match[1] ?? match[2] ?? '').trim();
      return name ? { email, name } : { email };
    }

    return { email: raw };
  }

  private extractMessageId(data: NetcoreResponse | null): string | undefined {
    if (!data) return undefined;

    const nested = data.data ?? {};
    const candidates = [
      data.messageId,
      data.id,
      data.message_id,
      nested.messageId,
      nested.id,
      nested.message_id,
      nested.requestId,
    ];

    return candidates.find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const apiKey = process.env.NETCORE_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: new Error('NETCORE_API_KEY is not set'),
      };
    }

    const body = {
      from: this.parseAddress(options.from),
      subject: options.subject,
      content: [{ type: 'html', value: options.html }],
      personalizations: [
        {
          to: options.to.map((recipient) => this.parseAddress(recipient)),
        },
      ],
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          api_key: apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as NetcoreResponse | null;

      if (!response.ok) {
        return {
          success: false,
          error: new Error(
            `Netcore API error ${response.status}: ${JSON.stringify(data)}`,
          ),
        };
      }

      const status =
        typeof data?.status === 'string' ? data.status.toLowerCase() : '';
      if (data?.error || status === 'error' || status === 'failed') {
        return {
          success: false,
          error: new Error(`Netcore API rejected the message: ${JSON.stringify(data)}`),
        };
      }

      return {
        success: true,
        messageId: this.extractMessageId(data),
      };
    } catch (err) {
      return { success: false, error: err };
    }
  }
}
