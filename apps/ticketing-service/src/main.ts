import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import multipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { validateEncryptionKey } from 'cookie-crypto';
import { createPinoLogger, createFastifyLogger,
  registerRequestIdHook,
  registerHttpAccessHook,
  buildValidationLog,
} from '@repo/logger';

async function bootstrap() {
  const logger = createPinoLogger('ticketing-service');
  const fastifyLogger = createFastifyLogger('ticketing-service');

  validateEncryptionKey(process.env.COOKIE_ENCRYPTION_KEY);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: fastifyLogger }),
  );

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 5,
    },
  });

  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_ENCRYPTION_KEY,
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
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
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
    credentials: true,
  });

  app.setGlobalPrefix('api');

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

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT, '0.0.0.0');

  logger.info({ event: 'service.start' }, `Ticketing Service is running on port ${PORT}/api`);
  logger.info({ event: 'database.connect' }, `Database: ${process.env.TICKETING_DATABASE_URL ? 'Connected' : 'Not Configured'}`);
}

bootstrap();