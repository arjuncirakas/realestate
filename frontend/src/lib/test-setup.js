import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Unmounts anything rendered in a test.
 *
 * Testing Library registers this itself only when vitest exposes globals. This
 * project uses explicit imports (`globals: false`) so ESLint can see every
 * identifier a test uses, which means the cleanup has to be wired up by hand —
 * without it the DOM accumulates across tests and queries start matching several
 * elements at once.
 */
afterEach(cleanup);

/**
 * Makes `React` available as a global in tests.
 *
 * Vite 8 transforms with rolldown/oxc rather than esbuild, and the automatic JSX
 * runtime that `@vitejs/plugin-react` configures for the app build does not reach
 * the transform pipeline vitest uses — JSX in a test compiles to
 * `React.createElement` and then fails with "React is not defined". Setting
 * `oxc.jsx` in vite.config.js does not change it, with or without the plugin
 * present, so this is the seam rather than the cause.
 *
 * The production build is unaffected: it emits `react/jsx-runtime` imports, so
 * nothing shipped reads this global. Delete this line once the Vite/vitest
 * integration honours the JSX runtime setting.
 */
globalThis.React = React;
