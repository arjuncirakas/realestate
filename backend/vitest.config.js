import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Explicit imports from 'vitest' instead of injected globals, so ESLint can
    // see every identifier a test file uses.
    globals: false,
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    setupFiles: ['./tests/setup-env.js'],
    // Integration tests share one Postgres database; parallel files would race
    // on the same rows.
    fileParallelism: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.js'],
      exclude: ['src/contracts/**'],
    },
  },
});
