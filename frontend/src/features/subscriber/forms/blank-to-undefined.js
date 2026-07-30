import { z } from 'zod';

/**
 * Treats a blank form field the same as an omitted one.
 *
 * An HTML input can never hand react-hook-form `undefined` — an untouched or
 * cleared optional field is always `''` — so without this, clearing a field
 * like phone or indicative amount fails validation instead of being treated
 * as "not provided". This wraps the schema imported from `@/contracts/`; it
 * does not restate any rule that schema enforces (Section 9.3).
 *
 * @param {import('zod').ZodTypeAny} schema an optional field's schema, taken from a contract
 * @returns {import('zod').ZodTypeAny}
 */
export const blankToUndefined = (schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);
