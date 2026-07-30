import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the backend package.
 *
 * Two project rules are enforced mechanically here because there is no
 * compiler to catch them: `require()` is banned (Section 2.1) and `process.env`
 * may only be read inside `src/config/env.js` (Section 8.2).
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'uploads/**',
      'prisma/migrations/**',
      'prisma/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'properties'],
      eqeqeq: ['error', 'smart'],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='require']",
          message: 'ES modules only — use import (Section 2.1).',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read configuration from src/config/env.js, not process.env (Section 8.2).',
        },
      ],
    },
  },
  {
    // The single permitted reader of process.env.
    files: ['src/config/env.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='require']",
          message: 'ES modules only — use import (Section 2.1).',
        },
      ],
    },
  },
  {
    // Tooling scripts run outside the app and may report to stdout.
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  prettier,
];
