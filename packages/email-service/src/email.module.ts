import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { ResendEmailProvider } from './adapters/resend.adapter';
import { SmartPingEmailProvider } from './adapters/smartping.adapter';
import { EMAIL_PROVIDER } from './constants';

@Global()
@Module({
  providers: [
    ResendEmailProvider,
    SmartPingEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        resend: ResendEmailProvider,
        smartping: SmartPingEmailProvider,
      ) => {
        const providerName =
          process.env.EMAIL_PROVIDER?.toLowerCase() ?? 'smartping';
        if (providerName === 'resend') return resend;
        return smartping;
      },
      inject: [ResendEmailProvider, SmartPingEmailProvider],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
