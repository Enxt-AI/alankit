import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export function buildPinoOptions(service: string): pino.LoggerOptions {
  return {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings(bindings) {
        return {
          service,
          hostname: bindings.hostname,
          environment: process.env.NODE_ENV || 'development',
        };
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    redact: {
      paths: [
        'phone',
        'email',
        'token',
        'password',
        'authorization',
        'cookie',
        'set-cookie',
        '*.phone',
        '*.email',
        '*.token',
        '*.password',
        '*.authorization',
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers.set-cookie',
      ],
      censor: '[REDACTED]',
      remove: false,
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };
}