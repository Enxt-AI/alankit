export interface SendEmailOptions {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: unknown;
}

export interface EmailProvider {
  readonly providerName: string;
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}
