import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'node:path';

// The fridge runs an old Chromium on Tizen. plugin-legacy compiles a second, ES5 bundle with
// polyfills and loads it on browsers that lack modern module support. Until the probe reports the
// real version, assume a Chrome 63-era browser.
export default defineConfig({
  base: './',
  plugins: [legacy({ targets: ['chrome >= 61'], modernPolyfills: true })],
  build: {
    cssTarget: 'chrome61',
    // public/probe/ is copied as-is: the probe must stay hand-written ES5.
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
