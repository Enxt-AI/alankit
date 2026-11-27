import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { createPinoLogger, createFastifyLogger,
  registerRequestIdHook,
  registerHttpAccessHook,
} from '@/logger';

async function bootstrap() {
  const logger = createPinoLogger('storage-service');
  const fastifyLogger = createFastifyLogger('storage-service');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: fastifyLogger }),
  );

  await app.register(fastifyCookie);

  await app.register(cors, {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://unlistedstocks.com',
      'https://www.unlistedstocks.com',
      'https://api.unlistedstocks.com',
      'https://api.unlistedstocks.com:90',
      'http://api.unlistedstocks.com:90',
      'https://panels.unlistedstocks.com',
      'https://distributors.unlistedstocks.com',
      'http://localhost:3000',
      'http://localhost:4000',
      'http://localhost:8000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-User-Id',
      'x-client-type',
      'x-device-fingerprint',
      'x-dpop-proof',
      'x-dpop-timestamp',
      'x-dpop-jti',
      'x-idempotency-key',
    ],
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  const fastifyInstance = app.getHttpAdapter().getInstance();

  registerRequestIdHook(fastifyInstance);
  registerHttpAccessHook(fastifyInstance);

  fastifyInstance.addHook('onSend', (request: any, reply: any, payload: any, done: () => void) => {
    reply.removeHeader('x-powered-by');
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('server');
    reply.removeHeader('Server');
    done();
  });

  const port = process.env.PORT || 3005;
  await app.listen(port, '0.0.0.0');
  logger.info({ event: 'service.start' }, `Storage Service running on http://localhost:${port}`);
}
bootstrap();