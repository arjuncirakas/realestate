import { ValidationError } from '../utils/app-error.js';
import { formatZodIssues } from '../utils/zod-error.js';

/**
 * Validates a request against contract schemas and replaces the raw values with
 * the parsed ones (Section 9.1: validate at every boundary).
 *
 * Handlers downstream therefore receive coerced, defaulted, trimmed data — a
 * `limit` that is a number rather than the string `'20'`, an email already
 * lowercased — and never have to re-check it.
 *
 *   router.get(
 *     '/properties',
 *     validate({ query: PropertyListQuerySchema }),
 *     asyncHandler(listProperties),
 *   );
 *
 * @param {{ params?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, body?: import('zod').ZodTypeAny }} schemas
 * @returns {import('express').RequestHandler}
 */
export const validate = (schemas) => (req, res, next) => {
  // params first: a bad id should be reported before the body is examined.
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new ValidationError(
          'Some of the details provided are not valid.',
          formatZodIssues(result.error),
        ),
      );
      return;
    }

    req[part] = result.data;
  }

  next();
};
