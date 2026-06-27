import { createFileRoute } from "@tanstack/react-router";
import { getAsuraScanList } from "@/lib/scrapers/asurascan";
import { isAdultText } from "@/lib/settings";

// ─── Server-side browse cache ────────────────────────────────────────────────
// Mirrors /api/manga/browse: the first request in a 5-minute window pays the
// AsuraScans API call; subsequent requests for the same page are instant.

const CACHE = new Map<string, { result: unknown; at: number }>();
const CACHE_TTL = 5 * 60_000;

function getCache(key: string) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL) {
    CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: unknown) {
  if (CACHE.size >= 200) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(key, { result, at: Date.now() });
}

export const Route = createFileRoute("/api/manga/asura")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const key = `asura:manhwa:${page}`;

        const cached = getCache(key);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
          });
        }

        try {
          const { items, hasMore } = await getAsuraScanList(page, 20);
          const result = {
            items: items.map((s) => ({
              id: `manhwa:${s.slug}`,
              title: s.title,
              kind: "manhwa",
              genre: s.genres?.[0] || "Manhwa",
              badge: "MANHWA",
              image: s.cover || "",
              // Flag adult titles using the FULL genre list (the client only
              // receives genres[0], which may not be the mature tag).
              nsfw: isAdultText(...(s.genres || [])),
            })),
            hasMore,
          };
          setCache(key, result);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=120, s-maxage=300",
              "X-Cache": "MISS",
            },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: String(e), items: [], hasMore: false }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
