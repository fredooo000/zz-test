import { createFileRoute } from "@tanstack/react-router";

// MegaPlay endorses Anikoto as the primary data source for discovery.
// This proxy forwards to Anikoto's API so the MegaPlay client works
// through the same-origin proxy pattern.
const BASE = "https://anikotoapi.site";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=120, s-maxage=300",
};

export const Route = createFileRoute("/api/public/megaplay/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const upstream = `${BASE}/${splat}${url.search}`;
        try {
          const res = await fetch(upstream, {
            headers: { Accept: "application/json", "User-Agent": "Kyrox/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "megaplay_unreachable", message: String(e) }),
            { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
