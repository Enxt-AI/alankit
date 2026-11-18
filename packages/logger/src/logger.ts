import pino from 'pino';
import { buildPinoOptions } from './pino.config.js';

const loggers = new Map<string, pino.Logger>();

export function createPinoLogger(service: string): pino.Logger {
  const existing = loggers.get(service);
  if (existing) return existing;

  const instance = pino(buildPinoOptions(service));
  loggers.set(service, instance);
  return instance;
}

export function createFastifyLogger(service: string): pino.Logger {
  const parent = createPinoLogger(service);
  return parent.child({ level: 'warn' });
}

export function getPinoLogger(service: string): pino.Logger {
  return loggers.get(service) ?? createPinoLogger(service);
}