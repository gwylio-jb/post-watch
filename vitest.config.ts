/**
 * Vitest config — co-exists with the Vite app build (vite.config.ts).
 *
 * `defineConfig` from `vitest/config` re-exports Vite's config so plugin
 * resolution and module aliasing match exactly what the app ships with.
 * No separate Vitest plugin chain to drift out of sync.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // happy-dom over jsdom — on Node 25+ jsdom collides with Node's
    // experimental built-in localStorage (the --localstorage-file warning).
    // happy-dom ships its own Storage shim that ignores Node's, and is
    // ~3x faster on a cold start anyway.
    environment: 'happy-dom',
    globals: true,                  // describe/it/expect without imports
    setupFiles: ['./test/setup.ts'],
    css: false,                     // skip CSS module parsing in tests; speeds up suite ~3x
    // Component tests of redesigned pages need <html class="theme-dark">
    // present (the legacy-token bridge keys off it). The setup file pins
    // it on; resetting between tests would break that, so leave it alone.
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/pdf/**',           // @react-pdf/renderer pulls heavy fontkit deps; smoke-tested elsewhere
        'src/data/**',          // static data tables — no logic to cover
      ],
    },
  },
});
