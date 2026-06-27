import { createFileRoute } from "@tanstack/react-router";
import { parseCategoryPage, titleMatchScore } from "@/lib/scrapers/mangafire";
import { searchAsuraScan } from "@/lib/scrapers/asurascan";

const MANGAFIRE = "https://mangafire.to";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: MANGAFIRE + "/",
};

// ─── Server-side resolve cache ────────────────────────────────────────────────
// /api/manga/resolve is called every time a user clicks a manga/manhwa card.
// Without caching, each click triggers: AsuraScan search + MangaFire page scan
// + 3 Consumet provider searches, all sequentially. This is 4–15s of latency.
// With caching, repeated title lookups are <5ms.

const RESOLVE_CACHE = new Map<string, { result: unknown; at: number }>();
const RESOLVE_TTL = 30 * 60_000; // 30 minutes — slug mappings are stable

function resolveKey(title: string, kind: string) {
  return `resolve:${kind}:${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function getCachedResolve(key: string) {
  const entry = RESOLVE_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > RESOLVE_TTL) {
    RESOLVE_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResolve(key: string, result: unknown) {
  if (RESOLVE_CACHE.size >= 500) {
    const first = RESOLVE_CACHE.keys().next().value;
    if (first) RESOLVE_CACHE.delete(first);
  }
  RESOLVE_CACHE.set(key, { result, at: Date.now() });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Previously searched pages 1–3 sequentially (3 × 8s = up to 24s worst case).
// Now fetches all pages in parallel and races them — total time = slowest single
// page fetch rather than sum of all pages.
async function searchCategoryPagesParallel(
  title: string,
  category: string,
  maxPages = 3,
): Promise<{ id: string; title: string; score: number } | null> {
  const pageNums = Array.from({ length: maxPages }, (_, i) => i + 1);

  const results = await Promise.allSettled(
    pageNums.map(async (page) => {
      const res = await fetch(`${MANGAFIRE}/type/${category}?page=${page}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(6000), // tighter timeout per page
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { items } = parseCategoryPage(await res.text());
      return items
        .map((item) => ({ id: item.id, title: item.title, score: titleMatchScore(item.title, title) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)[0] ?? null;
    }),
  );

  let best: { id: string; title: string; score: number } | null = null;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && (!best || r.value.score > best.score)) {
      best = r.value;
    }
  }
  return best;
}

async function resolveViaConsumet(
  title: string,
  provider = "mangakakalot",
): Promise<{ id: string; title: string; source: string } | null> {
  try {
    const base = process.env.CONSUMET_BASE_URL;
    if (!base) return null;
    const res = await fetch(`${base}/manga/${provider}/${encodeURIComponent(title)}`, {
      signal: AbortSignal.timeout(6000), // was 8s
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || data;
    if (!Array.isArray(results) || results.length === 0) return null;
    const best = results.reduce((a: any, b: any) => {
      const sa = titleMatchScore(a.title || "", title);
      const sb = titleMatchScore(b.title || "", title);
      return sa >= sb ? a : b;
    });
    return { id: best.id, title: best.title || "", source: `consumet-${provider}` };
  } catch {
    return null;
  }
}

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

async function searchAniListManga(
  title: string,
): Promise<{ id: number; title: { english?: string; romaji?: string; native?: string } } | null> {
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($search: String) {
          Page(perPage: 10) {
            media(search: $search, type: MANGA, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
              id title { romaji english native }
            }
          }
        }`,
        variables: { search: title },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const media = json.data?.Page?.media || [];
    if (!media.length) return null;

    const normQuery = title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const scored = media.map(
      (m: { id: number; title: { english?: string; romaji?: string; native?: string } }) => {
        const en = (m.title.english || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const ro = (m.title.romaji || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const enScore = en === normQuery ? 5 : en.startsWith(normQuery) ? 3 : en.includes(normQuery) ? 1 : 0;
        const roScore = ro === normQuery ? 5 : ro.startsWith(normQuery) ? 3 : ro.includes(normQuery) ? 1 : 0;
        return { ...m, score: Math.max(enScore, roScore) };
      },
    );
    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    return scored[0].score >= 1 ? scored[0] : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/manga/resolve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get("title") || "";
        const kind = url.searchParams.get("kind") || "manga";

        if (!title || title.length < 2) {
          return new Response(JSON.stringify({ error: "Title too short" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Return cached resolve immediately — slug mappings don't change
        const key = resolveKey(title, kind);
        const cached = getCachedResolve(key);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
          });
        }

        try {
          const category = kind === "manhwa" ? "manhwa" : "manga";
          const allProviders = ["mangakakalot", "comick", "asurascans"];

          // ── Phase 1: Fire everything in parallel ──────────────────────────
          // Previously: AsuraScan → MangaFire (sequential pages) → Consumet (sequential).
          // Now: all sources fire simultaneously. Fastest winner resolves.
          // Typical time drops from 8–20s → 1–3s.

          const asuraPromise = kind === "manhwa"
            ? searchAsuraScan(title)
                .then((r) => {
                  if (!r.length) throw new Error("no asura results");
                  return { id: r[0].slug, title: r[0].title, source: "asurascan" };
                })
                .catch(() => null)
            : Promise.resolve(null);

          const mangafirePromise = searchCategoryPagesParallel(title, category, 3)
            .then((r) => {
              if (!r || r.score < 3) throw new Error("low score");
              return { id: r.id, title: r.title, source: "mangafire" };
            })
            .catch(() => null);

          const consumetPromise = Promise.any(
            allProviders.map((p) =>
              resolveViaConsumet(title, p).then((r) => {
                if (!r) throw new Error("no match");
                return r;
              }),
            ),
          ).catch(() => null);

          // Race all three — return the first non-null result
          const winner = await Promise.any([
            asuraPromise.then((r) => { if (!r) throw new Error("no asura"); return r; }),
            mangafirePromise.then((r) => { if (!r) throw new Error("no mangafire"); return r; }),
            consumetPromise.then((r) => { if (!r) throw new Error("no consumet"); return r; }),
          ]).catch(() => null);

          if (winner) {
            setCachedResolve(key, winner);
            return new Response(JSON.stringify(winner), {
              status: 200,
              headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
            });
          }

          // ── Phase 2: AniList alt-title fallback ───────────────────────────
          // Only reached if all Phase 1 sources returned nothing — rare.
          const anilist = await searchAniListManga(title);
          if (anilist) {
            const altTitles = [
              anilist.title.english,
              anilist.title.romaji,
              anilist.title.native,
            ].filter((t): t is string => !!t && t.toLowerCase() !== title.toLowerCase());

            for (const altTitle of [...new Set(altTitles)]) {
              const altWinner = await Promise.any([
                searchCategoryPagesParallel(altTitle, category, 2).then((r) => {
                  if (!r || r.score < 3) throw new Error("low");
                  return { id: r.id, title: r.title, source: "mangafire" };
                }),
                ...allProviders.map((p) =>
                  resolveViaConsumet(altTitle, p).then((r) => {
                    if (!r) throw new Error("no match");
                    return r;
                  }),
                ),
              ]).catch(() => null);

              if (altWinner) {
                setCachedResolve(key, altWinner);
                return new Response(JSON.stringify(altWinner), {
                  status: 200,
                  headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
                });
              }
            }
          }

          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
