import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { OBFUSCATED_COOKIE_NAMES } from 'cookie-crypto';
import { PinoNestLogger } from '@/logger';

const service = 'auth-service';
const ctx = 'GlobalExceptionFilter';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new PinoNestLogger(service, ctx);

  catch(exception: unknown, host: ArgumentsHost) {
    const httpCtx = host.switchToHttp();
    const response = httpCtx.getResponse<FastifyReply>();
    const request = httpCtx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof UnauthorizedException) {
      this.logger.warn(
        {
          event: 'access.unauthorized',
          method: request.method,
          url: request.url,
        },
        `401 Unauthorized on ${request.method} ${request.url}: ${exception.message}`,
      );

      const url = request.url || '';
      let cookieToClear: string | null = null;

      if (url.includes('/auth/admin/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN;
      else if (url.includes('/auth/cms/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN;
      else if (url.includes('/auth/support/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN;
      else if (url.includes('/auth/marketing/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN;
      else if (url.includes('/auth/accounting/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN;
      else if (url.includes('/auth/operation/'))
        cookieToClear = OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN;

      if (cookieToClear) {
        response.clearCookie(cookieToClear, {
          httpOnly: true,
          sameSite: 'lax',
          secure:
            process.env.NODE_ENV === 'production' &&
            process.env.SECURE_COOKIES !== 'false',
          path: '/',
        });
      }
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, any>;
        message = resObj.message || exception.message;
      } else {
        message = exceptionResponse || exception.message;
      }
    } else {
      const err = exception as any;
      this.logger.error(
        {
          event: 'server.internal_error',
          method: request.method,
          url: request.url,
          err,
        },
        `Unhandled Exception on ${request.method} ${request.url}: ${err?.message || err}`,
      );

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred. Please try again later.';
    }

    if (status >= 500) {
      message = 'An internal server error occurred. Please try again later.';
    } else if (
      !(exception instanceof HttpException) &&
      typeof message === 'string'
    ) {
      const lower = message.toLowerCase();
      if (
        lower.includes('prisma') ||
        lower.includes('select') ||
        lower.includes('update') ||
        lower.includes('delete') ||
        lower.includes('insert') ||
        lower.includes('table') ||
        lower.includes('column') ||
        lower.includes('foreign key') ||
        lower.includes('unique constraint') ||
        lower.includes('p2002') ||
        lower.includes('p2025') ||
        lower.includes('node_modules') ||
        lower.includes('at ') ||
        lower.includes('typeerror') ||
        lower.includes('syntaxerror')
      ) {
        message = 'Invalid request parameters or constraint violation.';
      }
    }

    response.status(status).send({
      statusCode: status,
      message,
    });
  }
}
