/**
 * Routes a failed mutation's field-level details onto the matching
 * react-hook-form inputs, so a rule the server enforces but the contract
 * schema could not express client-side (the geocoding fallback in
 * `PropertyCreateSchema`/`PropertyUpdateSchema`, for instance) still lands on
 * the right field rather than only a generic banner (Section 9.3: route
 * `ApiError.detailFor(field)` onto the matching input with `setError`).
 *
 * @param {import('@/api/client.js').ApiError} error
 * @param {(field: string, error: { message: string }) => void} setError react-hook-form's `setError`
 * @param {string[]} fields the form's own field names to check
 * @returns {void}
 */
export const applyServerFieldErrors = (error, setError, fields) => {
  if (!error?.details) return;
  for (const field of fields) {
    const message = error.detailFor(field);
    if (message) setError(field, { type: 'server', message });
  }
};
