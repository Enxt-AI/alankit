import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { runWithRequestId } from './request-context.js';

let accessLogger: pino.Logger | null = null;

function ensureAccessLogger(fastify: FastifyInstance): pino.Logger {
  if (!accessLogger) {
    const root = fastify.log as pino.Logger;
    accessLogger = (root as any)._parentLogger || root;
  }
  return accessLogger!;
}

export function registerRequestIdHook(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    const requestId =
      (request.headers['x-request-id'] as string) || randomUUID();
    (request as any).requestId = requestId;
    reply.header('x-request-id', requestId);
    runWithRequestId(requestId, () => done());
  });
}

export function registerHttpAccessHook(fastify: FastifyInstance): void {
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const requestId = (request as any).requestId || '-';
    const durationMs = reply.elapsedTime ? Number(reply.elapsedTime.toFixed(2)) : 0;
    const route = request.routeOptions?.url || request.url || '-';
    const logger = ensureAccessLogger(fastify);

    logger.info(
      {
        logType: 'http_access' as const,
        requestId,
        method: request.method,
        route,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
        contentLength: Number(reply.getHeader('content-length') || 0),
        userAgent: (request.headers['user-agent'] as string) || undefined,
        ip: request.ip || undefined,
      },
      `${request.method} ${route} ${reply.statusCode} ${durationMs}ms`,
    );

    done();
  });
}