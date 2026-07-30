import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { ErrorCode } from '../contracts/index.js';
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
  isAppError,
} from '../utils/app-error.js';
import { formatZodIssues } from '../utils/zod-error.js';
import { logger } from '../utils/logger.js';
import { UPLOAD_LIMITS } from '../contracts/index.js';

/**
 * The single place a non-2xx response is written (Section 5.1).
 *
 * The rule this file exists to enforce is that nothing internal escapes: Prisma
 * messages quote SQL and column names, Zod's raw issues expose the schema, and a
 * stack trace exposes paths. All three are logged and replaced with a message
 * that is safe to show a user.
 */

/** Multer's failure codes mapped to messages a person can act on. */
const MULTER_MESSAGES = Object.freeze({
  LIMIT_FILE_SIZE: `Each file must be ${UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)} MB or smaller.`,
  LIMIT_FILE_COUNT: `Upload at most ${UPLOAD_LIMITS.maxFiles} files at a time.`,
  LIMIT_UNEXPECTED_FILE: `Unexpected file field. Send files as "${UPLOAD_LIMITS.fieldName}".`,
  LIMIT_PART_COUNT: 'That upload had too many parts.',
  LIMIT_FIELD_KEY: 'One of the form field names is too long.',
  LIMIT_FIELD_VALUE: 'One of the form field values is too long.',
  LIMIT_FIELD_COUNT: 'That form had too many fields.',
});

/**
 * Translates a thrown value into the error the client should see.
 * @param {unknown} error
 * @returns {AppError}
 */
const toAppError = (error) => {
  if (isAppError(error)) return error;

  // A schema parsed outside the validate middleware — a third-party response,
  // or a service validating its own arguments.
  if (error instanceof ZodError) {
    return new ValidationError(
      'Some of the details provided are not valid.',
      formatZodIssues(error),
    );
  }

  if (error instanceof MulterError) {
    return new ValidationError(
      MULTER_MESSAGES[error.code] ?? 'That upload could not be accepted.',
      [{ field: error.field ?? UPLOAD_LIMITS.fieldName, message: error.code }],
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint. The target names columns, so it is logged, not sent.
        return new ConflictError('That already exists.');
      case 'P2025':
        return new NotFoundError();
      case 'P2003':
        return new ConflictError('That refers to a record which no longer exists.');
      default:
        return new InternalError();
    }
  }

  // Malformed JSON body, or a body over the size limit, from express.json().
  if (error?.type === 'entity.parse.failed') {
    return new ValidationError('The request body is not valid JSON.');
  }
  if (error?.type === 'entity.too.large') {
    return new ValidationError('The request body is too large.');
  }

  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    return new AppError(ErrorCode.UNAUTHENTICATED, 'Your session is not valid. Sign in again.');
  }

  return new InternalError();
};

/**
 * Terminal 404 for an unmatched route. Registered after every module router.
 * @type {import('express').RequestHandler}
 */
export const notFoundHandler = (req, res, next) => {
  next(new NotFoundError('That endpoint does not exist.'));
};

/**
 * Central error middleware. Must be registered last and must keep all four
 * parameters — Express identifies error handlers by arity.
 *
 * @param {unknown} error
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 * @returns {void}
 */
export const errorHandler = (error, req, res, _next) => {
  const appError = toAppError(error);
  const log = req.log ?? logger;

  if (appError.status >= 500) {
    // Unexpected: keep the original error, with its stack and any driver detail.
    log.error({ err: error, code: appError.code }, 'request failed');
  } else {
    log.info(
      { code: appError.code, status: appError.status, path: req.originalUrl },
      'request rejected',
    );
  }

  // A handler that already streamed cannot be given an envelope; ending the
  // response is all that is left.
  if (res.headersSent) {
    res.end();
    return;
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  });
};
