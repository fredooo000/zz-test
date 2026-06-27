// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // SPA mode: ship a static client shell and render the whole app on the
    // client. This removes per-request page SSR entirely, which was the source
    // of the "transport invoke timed out / h3 swallowed SSR error" 500 crashes
    // (Vite couldn't load useServerFn.js within its 60s SSR timeout on the slow
    // disk). Server functions and API routes (e.g. /api/proxy) still work.
    spa: {
      enabled: true,
      // SPA mode prerenders one shell page via a separate nested
      // `spa.prerender` config (not the top-level `prerender` key). That
      // prerender spins up a temp preview server hardcoded to look for the
      // server bundle at `dist/server/server.js`, but our nitro.output config
      // below remaps it to `.vercel/output/functions/__server.func/` for the
      // Vercel Build Output API — so the prerenderer can't find it and the
      // build fails with ERR_MODULE_NOT_FOUND on `/`. Disable it; the client
      // shell renders fine without a prerendered HTML file.
      prerender: { enabled: false },
    },
  },
  // ─── Vercel deploy target ───────────────────────────────────────────────────
  // The Lovable config defaults nitro to the `cloudflare-module` preset and
  // forces the build output into `dist/`. For Vercel we switch to nitro's
  // `vercel` preset and restore that preset's native output layout
  // (`.vercel/output`, the Vercel Build Output API v3) so `vite build` produces
  // artifacts Vercel auto-detects. All 15 `src/routes/api/*` handlers are
  // bundled into a single Vercel serverless function automatically.
  nitro: {
    preset: "vercel",
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__server.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    // got-scraping (pulled in transitively by @consumet/extensions) ships
    // strict ESM `exports` conditions that Nitro's bundler can't resolve a
    // valid entry point for. Kept as a backup external in case Nitro's own
    // bundling pass touches this; harmless if unused.
    externals: {
      external: ["got-scraping", "@consumet/extensions"],
    },
  },
  vite: {
    server: {
      port: 8080,
    },
    optimizeDeps: {
      // @consumet/extensions is only used server-side; its got-scraping dependency
      // is ESM-only and can't be resolved by esbuild's pre-bundler.
      exclude: ["@consumet/extensions"],
    },
    // got-scraping ships strict ESM `exports` conditions that Rollup's
    // commonjs resolver can't find a valid entry for when Vite bundles the
    // "nitro" server environment. ssr.external leaves it as a real
    // require()/import at runtime instead of inlining it.
    ssr: {
      external: ["got-scraping", "@consumet/extensions"],
    },
    // Belt-and-suspenders: also exclude at the Rollup level directly.
    build: {
      rollupOptions: {
        external: ["got-scraping", "@consumet/extensions"],
      },
    },
  },
});
