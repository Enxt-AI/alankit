import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { SmsService } from './sms.service';
import { SmsProcessor } from './sms.processor';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // 10 seconds
    }),
    BullModule.registerQueue({
      name: 'sms',
    }),
  ],
  providers: [SmsService, SmsProcessor],
  exports: [SmsService],
})
export class SmsModule {}
