import { LoggerService } from '@nestjs/common';
import pino from 'pino';
import { getPinoLogger } from './logger.js';
import { getRequestId } from './request-context.js';

export class PinoNestLogger implements LoggerService {
  private pino: pino.Logger;
  private context?: string;

  constructor(service: string, context?: string) {
    this.pino = getPinoLogger(service);
    this.context = context;
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: any, ...optionalParams: any[]): void {
    this.info(message, ...optionalParams);
  }

  info(message: any, ...optionalParams: any[]): void {
    this.pino.info(this.buildPayload(message, optionalParams), this.extractMsg(message));
  }

  error(message: any, ...optionalParams: any[]): void {
    this.pino.error(this.buildPayload(message, optionalParams), this.extractMsg(message));
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.pino.warn(this.buildPayload(message, optionalParams), this.extractMsg(message));
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.pino.debug(this.buildPayload(message, optionalParams), this.extractMsg(message));
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.pino.trace(this.buildPayload(message, optionalParams), this.extractMsg(message));
  }

  private buildPayload(message: any, optionalParams: any[]): Record<string, unknown> {
    const requestId = getRequestId();
    const payload: Record<string, unknown> = {
      logType: 'application_event',
    };

    if (requestId) payload.requestId = requestId;
    if (this.context) payload.context = this.context;

    if (typeof message === 'object' && message !== null) {
      Object.assign(payload, message);
    }

    for (const param of optionalParams) {
      if (typeof param === 'string' && !param.startsWith('Trace:')) {
        if (!payload.reason) payload.reason = param;
      }
      if (param instanceof Error) {
        payload.err = param;
      }
    }

    return payload;
  }

  private extractMsg(message: any): string {
    if (typeof message === 'string') return message;
    if (typeof message === 'object' && message !== null && typeof message.msg === 'string') {
      return message.msg;
    }
    return '';
  }

  child(bindings: Record<string, unknown>): PinoNestLogger {
    const child = new PinoNestLogger('', this.context);
    child.pino = this.pino.child(bindings);
    return child;
  }
}