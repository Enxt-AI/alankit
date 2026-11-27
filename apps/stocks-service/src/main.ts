import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import fastifyCookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { FastifyRequest } from 'fastify';
import { validateEncryptionKey } from 'cookie-crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { createPinoLogger, createFastifyLogger,
  registerRequestIdHook,
  registerHttpAccessHook,
  buildValidationLog,
} from '@/logger';

async function bootstrap() {
  const logger = createPinoLogger('stocks-service');
  const fastifyLogger = createFastifyLogger('stocks-service');

  validateEncryptionKey(process.env.COOKIE_ENCRYPTION_KEY);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: fastifyLogger, trustProxy: true }),
  );

  await app.register(fastifyCookie);

  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });

  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
  });

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
      'x-panel-context',
      'x-dpop-proof',
      'x-dpop-timestamp',
      'x-dpop-jti',
      'x-idempotency-key',
    ],
  });

  const fastifyApp = (app as any).getHttpAdapter().getInstance();

  fastifyApp.addHook('preParsing', async (request: any, _reply: any, payload: any) => {
    if (
      request.url.startsWith('/api/marketing/webhooks/') ||
      request.url.startsWith('/api/kyc-integration/webhook')
    ) {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks);
      request.rawBody = rawBody.toString('utf8');

      const { Readable } = require('stream');
      const newStream = new Readable();
      newStream.push(rawBody);
      newStream.push(null);
      return newStream;
    }
    return payload;
  });

  registerRequestIdHook(fastifyApp);
  registerHttpAccessHook(fastifyApp);

  logger.info({ event: 'webhook.raw_body' }, 'Custom raw body capture registered for webhook signature verification');

  logger.info({ event: 'cors.configured' }, `CORS enabled for ${process.env.FRONTEND_URL || 'http://localhost:3000'} with credentials`);

  app.setGlobalPrefix('api');

  fastifyApp.addHook('onSend', (request: any, reply: any, payload: any, done: () => void) => {
    reply.removeHeader('x-powered-by');
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('server');
    reply.removeHeader('Server');
    done();
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const { payload, message } = buildValidationLog(errors);
        logger.warn(payload, message);

        const genericErrors = errors.map((err) => ({
          field: err.property,
          message: 'Invalid input format',
        }));

        return new BadRequestException({
          message: 'Validation failed',
          errors: genericErrors,
        });
      },
    }),
  );

  const PORT = process.env.PORT || 3003;
  await app.listen(PORT, '0.0.0.0');

  logger.info({ event: 'service.start' }, `Stocks Service running on http://localhost:${PORT}/api`);
  logger.info({ event: 'database.connect' }, `Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not Configured'}`);
}

bootstrap();