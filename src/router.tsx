import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Rendered into the static SPA shell (and on any route transition) while the
// app boots on the client. Kept dependency-free so it works before the rest of
// the bundle hydrates.
function AppLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0a0f",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "3px solid rgba(99,102,241,0.25)",
          borderTopColor: "#6366f1",
          animation: "kyrox-spin 0.8s linear infinite",
        }}
      />
      <style>{"@keyframes kyrox-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// ─── QueryClient factory ──────────────────────────────────────────────────────
// staleTime: 2min   — data re-fetches after 2 min, so TV/movies feel live
// gcTime:    10min  — cache evicts after 10 min idle (prevents memory bloat on
//                     long sessions with many title pages)
// refetchOnWindowFocus: false  — no surprise refetches when tab regains focus
// refetchOnReconnect:   false  — avoid double-fetch on flaky mobile connections
// retry: 1 — one retry on transient failures, no more (proxy errors shouldn't
//             cascade into 3 slow retries)
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // NOTE: refetchOnMount intentionally left at default (true).
        // This means if a query goes stale between hover-preload and actual
        // navigation, the mount will trigger a background refetch — user sees
        // cached data instantly, fresh data arrives shortly after.
        // Previously this was false, which caused stale data with no refresh.
      },
    },
  });
}

// ─── Singletons ───────────────────────────────────────────────────────────────
// Server singletons are module-level. In Cloudflare Workers each isolate
// handles one request at a time so this is safe — same as a per-request scope.
// In Node.js dev mode with hot-reload, these persist across reloads, which is
// a minor annoyance (stale cache after a rebuild) but not a correctness issue.
let browserQueryClient: QueryClient | undefined;
let browserRouter: ReturnType<typeof createRouter> | undefined;
let serverQueryClient: QueryClient | undefined;
let serverRouter: ReturnType<typeof createRouter> | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // SSR: one QueryClient for the lifetime of this isolate/request.
    // Must not be shared across requests — each Worker isolate gets its own.
    if (!serverQueryClient) serverQueryClient = makeQueryClient();
    return serverQueryClient;
  }
  // Client: singleton so navigating back reuses the cache.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ─── Router factory ───────────────────────────────────────────────────────────
// getRouter() is called multiple times per request by TanStack Start (route
// matching, loader, render). Memoising it here ensures both calls share the
// same QueryClient so prefetched data is found by the renderer.
export const getRouter = () => {
  if (typeof window === "undefined") {
    if (!serverRouter) {
      serverRouter = createRouter({
        routeTree,
        context: { queryClient: getQueryClient() },
        scrollRestoration: true,
        defaultPreload: "intent",
        // Preloaded data treated as fresh for 1 min.
        // Hover → navigate within 60s reuses preloaded data.
        // After 60s, mount refetch kicks in (refetchOnMount: true default).
        defaultPreloadStaleTime: 1 * 60_000,
        defaultPendingComponent: AppLoading,
      });
    }
    return serverRouter;
  }

  if (!browserRouter) {
    browserRouter = createRouter({
      routeTree,
      context: { queryClient: getQueryClient() },
      scrollRestoration: true,
      defaultPreload: "intent",
      defaultPreloadStaleTime: 1 * 60_000,
      defaultPendingComponent: AppLoading,
    });
  }
  return browserRouter;
};
