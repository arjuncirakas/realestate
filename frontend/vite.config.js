import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    /*
     * `@/` resolves to `src/`, matching the `@/*` path in jsconfig.json.
     *
     * jsconfig only informs the editor, so without an alias here an absolute
     * import would resolve while typing and then fail at build time. A single
     * prefixed alias is used rather than bare folder names (`components/...`)
     * because Vite applies aliases inside node_modules too, where a bare
     * `lib/` or `components/` prefix could shadow a dependency's own imports.
     *
     * Convention for the team: `@/` for anything outside the current folder,
     * relative paths within a folder.
     */
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/lib/test-setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Generated tree — its own guard is `npm run contracts:check`.
    exclude: ['node_modules/**', 'src/contracts/**'],
  },
});
