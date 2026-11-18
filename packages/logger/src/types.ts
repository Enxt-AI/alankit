export const LOG_TYPE_VALUES = ['http_access', 'application_event'] as const;
export type LogType = (typeof LOG_TYPE_VALUES)[number];

export interface HttpAccessLog {
  timestamp: string;
  level: string;
  logType: 'http_access';
  service: string;
  hostname: string;
  environment: string;
  requestId: string;
  method: string;
  route: string;
  url: string;
  statusCode: number;
  durationMs: number;
  contentLength?: number;
  userAgent?: string;
  ip?: string;
}

export interface ApplicationEventLog {
  timestamp: string;
  level: string;
  logType: 'application_event';
  service: string;
  hostname: string;
  environment: string;
  requestId?: string;
  event: string;
  reason?: string;
  context?: string;
  msg: string;
  err?: unknown;
  [key: string]: unknown;
}

export type StructuredLog = HttpAccessLog | ApplicationEventLog;