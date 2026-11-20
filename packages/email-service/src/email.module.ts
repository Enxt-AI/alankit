import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { NetcoreEmailProvider } from './adapters/netcore.adapter';
import { EMAIL_PROVIDER } from './constants';

@Global()
@Module({
  providers: [
    NetcoreEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: NetcoreEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
