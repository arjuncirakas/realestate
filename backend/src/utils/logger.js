import pino from 'pino';
import { env } from '../config/env.js';

/**
 * The application logger. `console.log` is banned project-wide (Section 9.1);
 * everything the server has to say goes through here.
 *
 * The redaction list matters more than it looks: `pino-http` logs whole request
 * and response objects, so without it every request would write the bearer
 * token and session cookie to the log.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.token',
      '*.tokenHash',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  // Human-readable output in development only; production emits JSON for the
  // log collector to parse.
  transport: env.isDevelopment
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
      }
    : undefined,
});
