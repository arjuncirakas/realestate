/**
 * Wraps an async route handler so a rejected promise reaches the error
 * middleware instead of becoming an unhandled rejection (Section 9.2).
 *
 * Express 4 does not await handlers, so without this a thrown error inside an
 * `async` function silently hangs the request.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
