import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { OrdersModule } from './orders/orders.module';
import { EsignProcessor } from './orders/esign.processor';
import { esignRedisOptions } from './orders/esign.config';

// No AppModule or ScheduleModule: replicas must not run API cron jobs or other queues.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ redis: esignRedisOptions(config) }),
    }),
    OrdersModule,
  ],
  providers: [EsignProcessor],
})
export class EsignWorkerModule {}
