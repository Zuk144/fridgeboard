import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';

// The fridge (probe, Nov 5 2026) runs Samsung's Tizen browser on Chrome 108, so the build targets
// it directly: one modern bundle, no legacy copy, no polyfills.

/**
 * `npm run dev` only: serves fake boards at /__fixture/<name>, built by running the real Code.gs
 * against fake calendars (test/fixtures/boards.ts). Never part of a build.
 */
function devFixtures(): Plugin {
  return {
    name: 'fridgeboard-dev-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fixture/', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/test/fixtures/boards.ts');
          const name = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
          const f = mod.makeFixture(name);
          if (!f) {
            res.statusCode = 404;
            res.end(Object.keys(mod.SCENARIOS).join(', '));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(f));
        } catch (e) {
          res.statusCode = 500;
          res.end(String((e as Error).stack || e));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [devFixtures()],
  build: {
    target: 'chrome108',
    cssTarget: 'chrome108',
    // public/probe/ is copied as-is: the probe must stay hand-written ES5.
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
