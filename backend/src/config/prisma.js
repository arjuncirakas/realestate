import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * The single Prisma client for the process.
 *
 * Every service imports this instance. Constructing a client per module would
 * open a connection pool per module, which on a small Cloud SQL instance is the
 * difference between working and exhausting `max_connections`.
 */
export const prisma = new PrismaClient({
  log: env.isDevelopment
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ]
    : [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
});

if (env.isDevelopment) {
  prisma.$on('query', (event) => {
    logger.debug(
      { query: event.query, params: event.params, durationMs: event.duration },
      'prisma',
    );
  });
}

prisma.$on('warn', (event) => logger.warn({ prisma: event.message }, 'prisma warning'));
prisma.$on('error', (event) => logger.error({ prisma: event.message }, 'prisma error'));

/**
 * Closes the connection pool. Called from the server's shutdown handler so a
 * redeploy does not leave sockets open on the database.
 * @returns {Promise<void>}
 */
export const disconnectPrisma = async () => {
  await prisma.$disconnect();
};
