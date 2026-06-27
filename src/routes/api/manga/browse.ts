import { createFileRoute } from "@tanstack/react-router";
import { scrapeCategoryPage } from "@/lib/scrapers/mangafire";

const MANGAFIRE = "https://mangafire.to";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: MANGAFIRE + "/",
};

// ─── Server-side in-memory cache ─────────────────────────────────────────────
// Without this, every browser request to /manga or /manhwa causes a live scrape
// of mangafire.to from your Worker — easily 2–5s per request. With this cache,
// the first request in a 5-minute window pays the scrape cost; all subsequent
// requests return in <5ms from memory.
//
// In Cloudflare Workers, this Map lives in the isolate for the lifetime of the
// Worker instance (typically minutes to hours depending on traffic). It won't
// survive a Worker restart, but that's fine — it's a browse cache, not a DB.

const CACHE = new Map<string, { result: unknown; at: number }>();
const CACHE_TTL = 5 * 60_000; // 5 minutes

function cacheKey(type: string, page: number) {
  return `browse:${type}:${page}`;
}

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
  // Keep memory bounded — evict if over 200 entries (covers ~16 pages × 12 types)
  if (CACHE.size >= 200) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(key, { result, at: Date.now() });
}

// ─── Background prefetch ──────────────────────────────────────────────────────
// When page 1 is requested, silently prefetch pages 2 and 3 so "Load More"
// clicks are instant. Fire-and-forget, never block the response.
function backgroundPrefetch(type: string, pages: number[]) {
  for (const page of pages) {
    const key = cacheKey(type, page);
    if (getCache(key)) continue; // already cached, skip
    fetch(`${MANGAFIRE}/type/${type}?page=${page}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    })
      .then((res) => (res.ok ? res.text() : null))
      .then((html) => {
        if (html) setCache(key, scrapeCategoryPage(html, type));
      })
      .catch(() => {}); // silently discard prefetch errors
  }
}

export const Route = createFileRoute("/api/manga/browse")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "manga";
        const page = parseInt(url.searchParams.get("page") || "1");

        const validTypes = ["manga", "manhwa", "manhua", "one-shot", "doujinshi", "novel"];
        if (!validTypes.includes(type)) {
          return new Response(JSON.stringify({ error: "Invalid type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Return cached result immediately if fresh
        const key = cacheKey(type, page);
        const cached = getCache(key);
        if (cached) {
          // Prefetch next pages while we have a fast response to return
          if (page === 1) backgroundPrefetch(type, [2, 3]);
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=120, s-maxage=300",
              "X-Cache": "HIT",
            },
          });
        }

        try {
          const res = await fetch(`${MANGAFIRE}/type/${type}?page=${page}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) {
            return new Response(
              JSON.stringify({ error: `Mangafire ${res.status}`, items: [], hasMore: false }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }
          const html = await res.text();
          const result = scrapeCategoryPage(html, type);

          // Store in cache
          setCache(key, result);

          // Prefetch next pages on first-page loads
          if (page === 1) backgroundPrefetch(type, [2, 3]);
          if (page === 2) backgroundPrefetch(type, [3, 4]);

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
          return new Response(JSON.stringify({ error: String(e), items: [], hasMore: false }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
