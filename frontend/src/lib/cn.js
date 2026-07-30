/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `tailwind-merge`: the primitives express appearance through
 * variant props rather than by expecting a caller's `className` to defeat their
 * base classes. Two conflicting utilities in one attribute are resolved by the
 * order of the generated stylesheet, not by the order they are written, so
 * "last one wins" would be a lie. `className` is for layout — margin, width,
 * grid placement — and appearance is a prop.
 *
 * @param {...(string | false | null | undefined)} classes
 * @returns {string}
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
