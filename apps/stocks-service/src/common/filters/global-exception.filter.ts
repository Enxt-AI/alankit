import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoNestLogger } from '@/logger';

const service = 'stocks-service';
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
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, any>;
        message = resObj.message || exception.message;
        if (resObj.errors !== undefined) {
          errors = resObj.errors;
        }
      } else {
        message = exceptionResponse || exception.message;
      }
    } else {
      const err = exception as any;
      this.logger.error(
        { event: 'server.internal_error', method: request.method, url: request.url, err },
        `Unhandled Exception on ${request.method} ${request.url}: ${err?.message || err}`,
      );

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred. Please try again later.';
    }

    if (status >= 500) {
      message = 'An internal server error occurred. Please try again later.';
    } else if (typeof message === 'string') {
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

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
    };
    if (errors !== undefined && status < 500) {
      body.errors = errors;
    }
    response.status(status).send(body);
  }
}