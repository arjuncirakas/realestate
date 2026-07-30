import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { API_PREFIX, JSON_BODY_LIMIT, UPLOADS_ROUTE } from './config/constants.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { getLocalStorageMount } from './services/storage.js';
import { HealthResponseSchema } from './contracts/index.js';
import { logger } from './utils/logger.js';
import { authModuleRoutes } from './modules/auth/index.routes.js';
import { enquiryRoutes } from './modules/enquiries/enquiries.routes.js';
import { interestRoutes } from './modules/interests/interests.routes.js';
import { logsRoutes } from './modules/logs/logs.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { ownershipRoutes } from './modules/ownership/ownership.routes.js';
import { propertiesRoutes } from './modules/properties/properties.routes.js';
import { savedRoutes } from './modules/saved/saved.routes.js';
import { siteVisitRoutes } from './modules/visits/visits.routes.js';

// --- module route imports ---------------------------------------------------
// Section 13.1: exactly one import line per module, added by that module's work
// package. Alphabetical. Nothing else in this block.
// ---------------------------------------------------------------------------

/**
 * Builds the Express application. Kept separate from `server.js` so tests can
 * mount it with supertest without binding a port.
 *
 * @returns {import('express').Express}
 */
export const createApp = () => {
  const app = express();

  // Cloud Run and any other reverse proxy terminate TLS and forward the client
  // address in X-Forwarded-For. Without this, express-rate-limit would key every
  // request in production to the proxy's address and limit all users as one.
  // Left off in development, where trusting the header would let a client spoof
  // its own IP past the rate limiter.
  app.set('trust proxy', env.isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      // Required for the refresh-token cookie to be sent cross-origin
      // (frontend on :5173, API on :4000).
      credentials: true,
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      // Request logs are noise in a test run; failures are still reported by
      // the error handler.
      autoLogging: !env.isTest,
    }),
  );

  // Serve locally stored uploads. With the GCS driver the bucket serves them and
  // this mount is skipped entirely.
  const localMount = getLocalStorageMount();
  if (localMount) {
    app.use(
      UPLOADS_ROUTE,
      express.static(localMount.directory, {
        index: false,
        // Uploaded files are user content: never let the browser guess a type
        // for them, and never execute them as one.
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Disposition', 'inline');
        },
      }),
    );
  }

  /**
   * Liveness only — it deliberately does not touch the database, so a failing
   * health check means the process is wedged rather than that Postgres is busy.
   */
  app.get('/health', (req, res) => {
    res.json({
      data: HealthResponseSchema.parse({
        status: 'ok',
        uptimeSeconds: Number(process.uptime().toFixed(3)),
        timestamp: new Date().toISOString(),
      }),
      meta: {},
    });
  });

  // --- module route registration --------------------------------------------
  // Section 13.1: exactly one `app.use()` line per module, mounted on
  // API_PREFIX. Each module's routes file declares its own full sub-paths, so a
  // module owning several prefixes (`/properties/:id/enquiries`, `/enquiries`,
  // `/me/enquiries`) still needs only this one line:
  //
  //   app.use(API_PREFIX, enquiryRoutes);
  //
  // Anything more than one line belongs to the lead, not to a work package.
  // -------------------------------------------------------------------------

  app.use(API_PREFIX, authModuleRoutes);
  app.use(API_PREFIX, enquiryRoutes);
  app.use(API_PREFIX, interestRoutes);
  app.use(API_PREFIX, logsRoutes);
  app.use(API_PREFIX, mediaRoutes);
  app.use(API_PREFIX, ownershipRoutes);
  app.use(API_PREFIX, propertiesRoutes);
  app.use(API_PREFIX, savedRoutes);
  app.use(API_PREFIX, siteVisitRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
