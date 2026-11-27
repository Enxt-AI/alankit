import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { validateEncryptionKey } from 'cookie-crypto';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import {
  createPinoLogger,
  createFastifyLogger,
  registerRequestIdHook,
  registerHttpAccessHook,
  buildValidationLog,
} from '@repo/logger';

async function bootstrap() {
  const logger = createPinoLogger('auth-service');
  const fastifyLogger = createFastifyLogger('auth-service');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: fastifyLogger, trustProxy: true }),
  );

  const configService = app.get(ConfigService);
  validateEncryptionKey(configService.get('COOKIE_ENCRYPTION_KEY'));

  await app.register(fastifyCookie);

  await app.register(cors, {
    origin: [process.env.FRONTEND_URL as string],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  logger.info(
    { event: 'cors.configured' },
    `CORS enabled for ${process.env.FRONTEND_URL || 'http://localhost:3000'} with credentials`,
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const { payload, message } = buildValidationLog(errors);
        logger.warn(payload, message);

        const firstError = errors[0];
        const constraintMsg = firstError?.constraints
          ? Object.values(firstError.constraints)[0]
          : 'Validation failed';

        const detailedErrors = errors.map((err) => ({
          field: err.property,
          message: err.constraints
            ? Object.values(err.constraints)[0]
            : 'Invalid input format',
        }));

        return new BadRequestException({
          statusCode: 400,
          message: constraintMsg,
          errors: detailedErrors,
        });
      },
    }),
  );

  const fastifyInstance = app.getHttpAdapter().getInstance();

  registerRequestIdHook(fastifyInstance);
  registerHttpAccessHook(fastifyInstance);

  fastifyInstance.addHook(
    'onSend',
    (request: any, reply: any, payload: any, done: () => void) => {
      reply.removeHeader('x-powered-by');
      reply.removeHeader('X-Powered-By');
      reply.removeHeader('server');
      reply.removeHeader('Server');
      done();
    },
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const PORT = process.env.PORT || 3002;
  await app.listen(PORT, '0.0.0.0');

  logger.info(
    { event: 'service.start' },
    `Auth Service running on http://localhost:${PORT}/api`,
  );
  logger.info(
    { event: 'database.connect' },
    `Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not Configured'}`,
  );
}
bootstrap();
