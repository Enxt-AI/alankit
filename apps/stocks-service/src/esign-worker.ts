import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EsignWorkerModule } from './esign-worker.module';
import { createPinoLogger } from '@/logger';

const logger = createPinoLogger('stocks-service');
const esignLogger = logger.child({ context: 'EsignWorker' });

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(EsignWorkerModule);
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await app.get<Queue>(getQueueToken('alankit-esign')).close();
      await app.close();
    } catch (error) {
      esignLogger.error({ event: 'esign.shutdown.failed', err: error }, 'E-sign worker shutdown failed');
      process.exit(1);
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

bootstrap().catch(error => {
  esignLogger.error({ event: 'esign.startup.failed', err: error }, 'E-sign worker startup failed');
  process.exit(1);
});