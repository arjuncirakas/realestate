/* eslint-disable no-restricted-syntax -- the test harness must seed env before config/env.js parses it */

/**
 * Supplies the environment `src/config/env.js` requires so that importing the
 * app inside a test does not exit the process. Real values from a developer's
 * `.env` still win — these are only fallbacks.
 */
const defaults = {
  NODE_ENV: 'test',
  PORT: '4001',
  DATABASE_URL: 'postgresql://estate:estate@localhost:5433/estate_dev',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: '30',
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_PATH: './uploads',
  LOG_LEVEL: 'silent',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}
