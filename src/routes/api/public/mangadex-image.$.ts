import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://uploads.mangadex.org";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=86400, s-maxage=604800",
};

export const Route = createFileRoute("/api/public/mangadex-image/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        if (!splat || splat.includes("..")) {
          return new Response("Bad image path", { status: 400, headers: CORS });
        }

        try {
          const res = await fetch(`${BASE}/${splat}`, {
            headers: { "User-Agent": "Kyrox/1.0", Referer: "https://mangadex.org/" },
          });
          return new Response(res.body, {
            status: res.status,
            headers: {
              "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
              ...CORS,
            },
          });
        } catch (e) {
          return new Response(String(e), { status: 502, headers: CORS });
        }
      },
    },
  },
});
