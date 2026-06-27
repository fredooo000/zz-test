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
    spa: { enabled: true },
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
    // Kept as a backup in case Nitro's own bundling pass also touches this —
    // harmless if unused.
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
    // got-scraping (pulled in transitively by @consumet/extensions) ships
    // strict ESM `exports` conditions that Rollup's commonjs resolver can't
    // find a valid entry for ("No known conditions for '.' specifier") when
    // Vite bundles the "nitro" server environment. `ssr.external` tells Vite
    // to leave it as a real require()/import at runtime instead of inlining
    // it — applies to all SSR-type environments (including the nitro one).
    ssr: {
      external: ["got-scraping", "@consumet/extensions"],
    },
    // Belt-and-suspenders: also exclude at the Rollup level directly, in case
    // the nitro environment's build config doesn't inherit top-level ssr.external.
    build: {
      rollupOptions: {
        external: ["got-scraping", "@consumet/extensions"],
      },
    },
  },
});
