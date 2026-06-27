// Public proxy to Toonily (manhwa source with complete chapter lists).
// Returns raw HTML so the client/server scraper can parse it without CORS issues.
import { createFileRoute } from "@tanstack/react-router";

const BASE = process.env.TOONILY_BASE_URL || "https://toonily.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=120, s-maxage=300",
};

export const Route = createFileRoute("/api/public/toonily/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const upstream = `${BASE}/${splat}${url.search}`;
        try {
          const res = await fetch(upstream, {
            headers: {
              // Browser-like headers help avoid trivial bot blocks.
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: BASE + "/",
            },
            signal: AbortSignal.timeout(12000),
          });
          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "toonily_unreachable", message: String(e) }),
            { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
