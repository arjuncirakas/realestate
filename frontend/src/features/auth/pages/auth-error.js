/**
 * Turns a caught login/register error into what a form needs to show: either a
 * message attached to the field it is about, or banner copy for a failure no
 * field can explain (Section 6 — rate limiting is the main case).
 */

/**
 * Applies the field-level `details` on a `VALIDATION_ERROR` response
 * (Section 5.1) to the form, so each one lands next to the input the server
 * rejected rather than in a generic banner.
 *
 * @param {import('@/api/client.js').ApiError} error
 * @param {(name: string, value: { type: string, message: string }) => void} setError
 * @param {string[]} fields checked in order; the first one with a detail wins
 * @returns {boolean} whether a field absorbed the error
 */
const applyDetails = (error, setError, fields) => {
  for (const field of fields) {
    const message = error.detailFor(field);
    if (message) {
      setError(field, { type: 'server', message });
      return true;
    }
  }
  return false;
};

/**
 * Places a submission error on the right field when possible, otherwise
 * returns it for the caller to show as a banner.
 *
 * A register conflict (Section 5.2: 409 when the email is already registered)
 * carries no field-level `details` — email uniqueness is the only thing
 * `/auth/register` can conflict on, so the whole message is routed to the
 * email field rather than shown as a generic banner.
 *
 * @param {import('@/api/client.js').ApiError} error
 * @param {(name: string, value: { type: string, message: string }) => void} setError
 * @param {string[]} fields the form's field names, in detail-priority order
 * @returns {import('@/api/client.js').ApiError | null} the error to show as a
 *   banner, or `null` when it was placed on a field instead
 */
export const applyFormError = (error, setError, fields) => {
  if (!error?.isApiError) return error;

  if (applyDetails(error, setError, fields)) return null;

  if (error.code === 'CONFLICT' && fields.includes('email')) {
    setError('email', { type: 'server', message: error.message });
    return null;
  }

  return error;
};

/**
 * Banner copy for a submission error that could not be attached to a field.
 *
 * @param {import('@/api/client.js').ApiError} error
 * @param {string} action what the button promised, e.g. "sign in"
 * @returns {{ title: string, instruction: string }}
 */
export const bannerCopy = (error, action) => {
  if (error.code === 'RATE_LIMITED') {
    return {
      title: 'Too many attempts',
      instruction: 'Wait 15 minutes, then try again. Contact the office if this keeps happening.',
    };
  }

  return {
    title: `Could not ${action}`,
    instruction: 'Check the details above and try again.',
  };
};
