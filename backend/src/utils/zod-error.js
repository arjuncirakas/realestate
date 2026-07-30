/**
 * Converts a `ZodError` into the `details` array of the error envelope
 * (Section 5.1), so a form can put each message next to its field.
 *
 * @param {import('zod').ZodError} error
 * @returns {Array<{ field: string, message: string }>}
 */
export const formatZodIssues = (error) =>
  error.issues.map((issue) => ({
    // A root-level issue (a cross-field refinement with no path) is reported
    // against `_` rather than an empty string, which a form cannot key on.
    field: issue.path.length > 0 ? issue.path.join('.') : '_',
    message: issue.message,
  }));
