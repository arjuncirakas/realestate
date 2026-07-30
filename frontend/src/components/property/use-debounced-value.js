import { useEffect, useState } from 'react';

/**
 * Holds a value back until it has stopped changing for `delayMs`.
 *
 * The map explorer's only use: a camera pan fires `onBoundsChanged` on every
 * frame, and feeding that straight into a query would fire `/properties/map`
 * dozens of times during one drag (Section 7.3). This is what turns that into
 * one request, 500ms after the pan settles.
 *
 * @template T
 * @param {T} value
 * @param {number} delayMs
 * @returns {T}
 */
export const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
