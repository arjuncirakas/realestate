import { ERROR_STATUS_BY_CODE, ErrorCode } from '../contracts/index.js';

/**
 * The error hierarchy every module throws. The central error middleware maps
 * these to the envelope in Section 5.1 — no route ever hand-builds an error
 * response, and nothing but these classes reaches the client with a message of
 * its own.
 *
 * Anything else that escapes a handler is treated as a bug: it is logged with
 * its stack and reported as a generic `INTERNAL_ERROR`.
 */
export class AppError extends Error {
  /**
   * @param {string} code one of the Section 5.1 error codes
   * @param {string} message human-readable and safe to display to a user
   * @param {Array<{ field: string, message: string }>} [details] field-level errors
   */
  constructor(code, message, details) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = ERROR_STATUS_BY_CODE[code] ?? 500;
    this.details = details;
    /** Marks the error as deliberate, so the handler knows it is not a bug. */
    this.isAppError = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}

/** 400 — the request failed validation. */
export class ValidationError extends AppError {
  /**
   * @param {string} [message]
   * @param {Array<{ field: string, message: string }>} [details]
   */
  constructor(message = 'Some of the details provided are not valid.', details) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
  }
}

/** 401 — no session, or a session that is no longer usable. */
export class UnauthenticatedError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Sign in to continue.') {
    super(ErrorCode.UNAUTHENTICATED, message);
  }
}

/**
 * 403 — authenticated but not allowed. Section 5.3 requires this rather than a
 * 404 when another user's record is requested, so the response never doubles as
 * a probe for whether that record exists.
 */
export class ForbiddenError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'You do not have access to this.') {
    super(ErrorCode.FORBIDDEN, message);
  }
}

/** 404 — no such record. */
export class NotFoundError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'We could not find what you were looking for.') {
    super(ErrorCode.NOT_FOUND, message);
  }
}

/** 409 — the request conflicts with the current state. */
export class ConflictError extends AppError {
  /**
   * @param {string} [message]
   * @param {Array<{ field: string, message: string }>} [details]
   */
  constructor(message = 'That conflicts with something that already exists.', details) {
    super(ErrorCode.CONFLICT, message, details);
  }
}

/** 429 — too many requests from this client. */
export class RateLimitedError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Too many requests. Wait a few minutes and try again.') {
    super(ErrorCode.RATE_LIMITED, message);
  }
}

/** 500 — the message is deliberately generic; detail goes to the log only. */
export class InternalError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Something went wrong at our end. Try again shortly.') {
    super(ErrorCode.INTERNAL_ERROR, message);
  }
}

/**
 * Narrows an unknown thrown value to a deliberate application error.
 * @param {unknown} error
 * @returns {boolean}
 */
export const isAppError = (error) => error instanceof AppError || error?.isAppError === true;
