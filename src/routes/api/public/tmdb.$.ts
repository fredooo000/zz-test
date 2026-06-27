import { createFileRoute } from "@tanstack/react-router";

// TMDB API key. Prefer the TMDB_API_KEY env var; fall back to the project key
// so the app works out of the box. Override in production via the env var.
const API_KEY = process.env.TMDB_API_KEY || "ab1461ee6244ac2a0bd7d7e55a128ef7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300, s-maxage=600",
};

export const Route = createFileRoute("/api/public/tmdb/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        if (!API_KEY) {
          return new Response(
            JSON.stringify({ error: "TMDB_API_KEY not configured. Set it in your .env file." }),
            { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const sep = url.search ? "&" : "?";
        const upstream = `https://api.themoviedb.org/3/${splat}${url.search}${sep}api_key=${API_KEY}`;
        try {
          const res = await fetch(upstream, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: "tmdb_unreachable", message: String(e) }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
