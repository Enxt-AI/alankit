import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';

const service = 'payments-service';
const ctx = 'GlobalExceptionFilter';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new PinoNestLogger(service, ctx);

  catch(exception: unknown, host: ArgumentsHost) {
    const httpCtx = host.switchToHttp();
    const response = httpCtx.getResponse<any>();
    const request = httpCtx.getRequest<any>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

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
        { event: 'server.internal_error', method: request.method, url: request.url, err },
        `Unhandled Exception on ${request.method} ${request.url}: ${err?.message || err}`,
      );

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected payment error occurred. Please try again later.';
    }

    if (status >= 500) {
      message = 'An internal payment error occurred. Please try again later.';
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
        message = 'Invalid payment parameters or constraint violation.';
      }
    }

    response.status(status).send({
      statusCode: status,
      message,
    });
  }
}