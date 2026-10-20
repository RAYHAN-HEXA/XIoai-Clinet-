import pino from 'pino';
import { env } from '../config/env';

/**
 * Never log secrets or PII: auth cookies/headers are redacted by pino-http,
 * and code must not pass credentials, tokens or raw emails into log calls.
 */
export const logger = pino({
  level:
    env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:SS' } }
      : undefined,
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.passwordHash'],
    censor: '[REDACTED]'
  }
});
