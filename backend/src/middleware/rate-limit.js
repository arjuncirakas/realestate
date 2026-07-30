import { MemoryStore, rateLimit } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/constants.js';
import { RateLimitedError } from '../utils/app-error.js';

/**
 * Rate limiters from Section 6. They live here rather than in a module because
 * the modules that need them own only `modules/**`, and both limiters are
 * applied to routes across more than one module.
 *
 * The handler throws `RateLimitedError` instead of letting express-rate-limit
 * write its own body, so a 429 uses the same envelope as every other error
 * (Section 5.1).
 */

/** Stores are held so tests can clear counters between cases. */
const stores = [];

/**
 * Builds a limiter from one of the `RATE_LIMITS` entries.
 * @param {{ windowMs: number, limit: number, message: string }} config
 * @returns {import('express').RequestHandler}
 */
const buildLimiter = ({ windowMs, limit, message }) => {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({
    windowMs,
    limit,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new RateLimitedError(message)),
  });
};

/** `/auth/login` and `/auth/register` — 5 per 15 minutes per IP. */
export const authRateLimiter = buildLimiter(RATE_LIMITS.auth);

/** Enquiry creation — 10 per hour per IP. */
export const enquiryRateLimiter = buildLimiter(RATE_LIMITS.enquiry);

/**
 * Clears every limiter's counters. Integration tests that exercise a limited
 * route more than a handful of times call this in `beforeEach`, so one test's
 * requests cannot exhaust the budget of the next.
 * @returns {Promise<void>}
 */
export const resetRateLimiters = async () => {
  await Promise.all(stores.map((store) => store.resetAll?.()));
};
