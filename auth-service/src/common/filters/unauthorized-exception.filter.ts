import { ExceptionFilter, Catch, ArgumentsHost, UnauthorizedException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { OBFUSCATED_COOKIE_NAMES } from 'cookie-crypto';

@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    
    // Auto-clear only the relevant panel cookie on 401
    const url = request.url || '';
    let cookieToClear: string | null = null;
    
    if (url.includes('/auth/admin/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN;
    else if (url.includes('/auth/cms/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN;
    else if (url.includes('/auth/support/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN;
    else if (url.includes('/auth/marketing/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN;
    else if (url.includes('/auth/accounting/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN;
    else if (url.includes('/auth/operation/')) cookieToClear = OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN;

    if (cookieToClear) {
      response.clearCookie(cookieToClear, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
        path: '/',
      });
    }

    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    response.status(status).send(errorResponse);
  }
}
