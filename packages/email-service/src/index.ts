export * from './email.module';
export * from './email.service';
export * from './interfaces/email-provider.interface';
export { ResendEmailProvider } from './adapters/resend.adapter';
export { SmartPingEmailProvider } from './adapters/smartping.adapter';
export { EMAIL_PROVIDER } from './constants';
