import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// ─── Error middleware ─────────────────────────────────────────────────────────
// IMPORTANT: TanStack Start middleware CANNOT return a Response. Only the value
// returned by next() propagates correctly. Any `return new Response(...)` here
// is silently discarded or causes undefined behaviour. Always re-throw.
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Re-throw h3/TanStack typed HTTP errors (redirects, 404, etc.) unchanged
    // so the framework handles them normally.
    //
    // Guard is strict: must be a plain object with a *numeric* statusCode in
    // the redirect/error range. This prevents accidentally shaped plain objects
    // (e.g. { statusCode: "404" } or { statusCode: 200 }) from bypassing the
    // error log below.
    if (
      error != null &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as Record<string, unknown>).statusCode === "number" &&
      (error as { statusCode: number }).statusCode >= 300 &&
      (error as { statusCode: number }).statusCode < 600
    ) {
      throw error;
    }

    // All other unhandled errors: log for observability, then re-throw.
    // server.ts catches this and renders the error page.
    // DO NOT return a Response here — see note at the top of this function.
    console.error("[errorMiddleware] Unhandled server error:", error);
    throw error;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
