import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://mangafire.to";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=120",
};

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: BASE + "/",
};

export const Route = createFileRoute("/api/public/mangafire/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);
        const upstream = `${BASE}/${splat}${url.search}`;
        try {
          const isAjax = splat.includes("/ajax/") || url.searchParams.has("ajax");
          const res = await fetch(upstream, {
            headers: {
              ...COMMON_HEADERS,
              ...(isAjax ? { "X-Requested-With": "XMLHttpRequest" } : {}),
              Accept: isAjax
                ? "application/json, text/plain, */*"
                : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(15000),
          });
          const body = await res.text();
          const contentType = isAjax
            ? "application/json"
            : res.headers.get("content-type")?.includes("json")
              ? "application/json"
              : "text/html; charset=utf-8";
          return new Response(body, {
            status: res.status,
            headers: { "Content-Type": contentType, ...CORS },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "mangafire_unreachable", message: String(e) }),
            { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
