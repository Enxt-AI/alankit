import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { validateEncryptionKey } from 'cookie-crypto';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { createPinoLogger, createFastifyLogger,
  registerRequestIdHook,
  registerHttpAccessHook,
  buildValidationLog,
} from '@smc/logger';

async function bootstrap() {
  const logger = createPinoLogger('payments-service');
  const fastifyLogger = createFastifyLogger('payments-service');

  validateEncryptionKey(process.env.COOKIE_ENCRYPTION_KEY);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: fastifyLogger }),
    { rawBody: true },
  );

  await app.register(fastifyCookie);

  await app.register(cors, {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://unlistedstox.com',
      'https://www.unlistedstox.com',
      'https://api.unlistedstox.com',
      'https://api.unlistedstox.com:90',
      'http://api.unlistedstox.com:90',
      'https://panels.unlistedstox.com',
      'https://distributors.unlistedstox.com',
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

  const PORT = process.env.PORT || 3004;
  await app.listen(PORT, '0.0.0.0');

  logger.info({ event: 'service.start' }, `Payments Service running on http://localhost:${PORT}/api`);
  logger.info({ event: 'database.connect' }, `Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not Configured'}`);
}

bootstrap();