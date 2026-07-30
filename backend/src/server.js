import { app } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './config/prisma.js';
import { logger } from './utils/logger.js';

/**
 * Process entry point. `app.js` builds the application; this file owns the
 * socket and the shutdown sequence.
 */

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, storage: env.STORAGE_DRIVER },
    `API listening on http://localhost:${env.PORT}`,
  );
});

let shuttingDown = false;

/**
 * Stops accepting connections, drains in-flight requests, then closes the
 * database pool. Without this a redeploy drops live requests and leaves
 * connections open on Cloud SQL until they time out.
 * @param {string} signal
 * @returns {Promise<void>}
 */
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  // Force-exit if a hung connection prevents the drain from finishing.
  const timeout = setTimeout(() => {
    logger.error('shutdown timed out, exiting');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(async (error) => {
    if (error) logger.error({ err: error }, 'error while closing the server');
    try {
      await disconnectPrisma();
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, 'error while closing the database pool');
    }
    clearTimeout(timeout);
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A rejection or exception that reaches here means state is unknown; log it and
// let the supervisor restart the process rather than continue half-broken.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException');
});
