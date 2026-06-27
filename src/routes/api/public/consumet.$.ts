import { createFileRoute } from "@tanstack/react-router";
import { ANIME, MANGA, MOVIES, LIGHT_NOVELS, META } from "@consumet/extensions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=120, s-maxage=300",
};

type ProviderCtor = new (...args: any[]) => any;

const PROVIDER_CLASSES: Record<string, Record<string, ProviderCtor>> = {
  // NOTE: keep these in sync with the installed @consumet/extensions version.
  // Providers removed upstream (MangaPark, MangaSee123, GogoAnime, AnimeFox,
  // BiliBili, Crunchyroll, Enime, Zoro, NineAnime, ReadLightNovels) are omitted.
  manga: {
    mangadex: MANGA.MangaDex,
    mangahere: MANGA.MangaHere,
    mangakakalot: MANGA.MangaKakalot,
    mangapill: MANGA.MangaPill,
    mangareader: MANGA.MangaReader,
    comick: MANGA.ComicK,
    asurascans: MANGA.AsuraScans,
    weebcentral: MANGA.WeebCentral,
  },
  anime: {
    hianime: ANIME.Hianime,
    animesaturn: ANIME.AnimeSaturn,
    animeunity: ANIME.AnimeUnity,
    kickassanime: ANIME.KickAssAnime,
    animepahe: ANIME.AnimePahe,
    animekai: ANIME.AnimeKai,
    animesama: ANIME.AnimeSama,
  },
  movies: {
    dramacool: MOVIES.DramaCool,
    flixhq: MOVIES.FlixHQ,
    goku: MOVIES.Goku,
    sflix: MOVIES.SFlix,
    himovies: MOVIES.HiMovies,
  },
  "light-novels": {
    novelupdates: LIGHT_NOVELS.NovelUpdates,
  },
};

const TMDB_API_KEY = process.env.TMDB_API_KEY || "ab1461ee6244ac2a0bd7d7e55a128ef7";
const META_CACHE: Record<string, any> = {};

function getMetaInstance(name: string) {
  if (!META_CACHE[name]) {
    const n = name.charAt(0).toUpperCase() + name.slice(1);
    if (name === "tmdb") {
      META_CACHE[name] = new (META as any)[n](TMDB_API_KEY);
    } else {
      META_CACHE[name] = new (META as any)[n]();
    }
  }
  return META_CACHE[name];
}

function getInstance(category: string, provider: string) {
  if (category === "meta") return getMetaInstance(provider);

  const classes = PROVIDER_CLASSES[category];
  if (!classes) throw new Error(`unknown category: ${category}`);

  const ctor = classes[provider];
  if (!ctor) throw new Error(`unknown ${category} provider: ${provider}`);

  return new ctor();
}

async function handleRequest(
  category: string,
  provider: string,
  action: string,
  params: URLSearchParams,
) {
  const inst = getInstance(category, provider);

  if (action === "info" || action.startsWith("info/")) {
    const id = action.startsWith("info/") ? action.slice(5) : params.get("id") || "";

    if (category === "meta" && provider === "anilist") return inst.fetchAnimeInfo(id, params.get("dub") === "true");
    if (category === "meta" && provider === "anilist-manga") return inst.fetchMangaInfo?.(id) ?? inst.fetchAnimeInfo(id);
    if (category === "meta") return inst.fetchMediaInfo(id, params.get("type") || "tv");
    if (inst.fetchMangaInfo) return inst.fetchMangaInfo(id);
    if (inst.fetchAnimeInfo) return inst.fetchAnimeInfo(id);

    throw new Error("info not supported for this provider");
  }

  if (action === "read") {
    const chapterId = params.get("chapterId") || "";
    return inst.fetchChapterPages(chapterId);
  }

  if (!inst.search) throw new Error("search not supported for this provider");

  return inst.search(action, Number(params.get("page")) || 1, Number(params.get("perPage")) || 20);
}

// Race: fire all providers for a category and return the first successful response
async function handleRace(
  category: string,
  action: string,
  params: URLSearchParams,
  url: URL,
) {
  const providers = Object.keys(PROVIDER_CLASSES[category] || {});
  if (!providers.length) throw new Error(`no providers for category: ${category}`);

  const attempts = providers.map((prov) =>
    (async () => {
      try {
        return await handleRequest(category, prov, action, params);
      } catch {
        throw new Error(`${prov} failed`);
      }
    })(),
  );

  const winner = await Promise.any(attempts);
  return winner;
}

const CONSUMET_BASE_URL = process.env.CONSUMET_BASE_URL;

async function proxyToExternal(request: Request, splat: string): Promise<Response> {
  const url = new URL(request.url);
  const target = `${CONSUMET_BASE_URL}/${splat}${url.search}`;
  const res = await fetch(target, {
    headers: { Accept: "application/json", "User-Agent": "Kyrox/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.text();
  return new Response(body, {
    status: res.ok ? res.status : 502,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function raceExternal(
  category: string,
  action: string,
  params: URLSearchParams,
): Promise<Response> {
  const providers = Object.keys(PROVIDER_CLASSES[category] || []);
  if (!providers.length) {
    return new Response(JSON.stringify({ error: `no providers for ${category}` }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const id = action.startsWith("info/") ? action.slice(5) : params.get("id") || "";
  const chapterId = params.get("chapterId") || "";
  const query = params.get("query") || action;

  const attempts = providers.map((prov) => {
    let ep = "";
    if (action === "info" || action.startsWith("info/")) {
      ep = `/manga/${prov}/info?id=${encodeURIComponent(id)}`;
    } else if (action === "read") {
      ep = `/manga/${prov}/read?chapterId=${encodeURIComponent(chapterId)}`;
    } else {
      ep = `/manga/${prov}/${encodeURIComponent(query)}?page=${params.get("page") || 1}&perPage=${params.get("perPage") || 20}`;
    }
    const isManga = category === "manga" || category === "light-novels";
    if (!isManga) {
      if (action === "info" || action.startsWith("info/")) {
        ep = `/anime/${prov}/info?id=${encodeURIComponent(id)}`;
      } else if (action === "read") {
        ep = `/anime/${prov}/watch/${encodeURIComponent(chapterId)}`;
      } else {
        ep = `/anime/${prov}/${encodeURIComponent(query)}?page=${params.get("page") || 1}&perPage=${params.get("perPage") || 20}`;
      }
      if (category === "movies") {
        ep = ep.replace("/anime/", "/movies/");
      }
    }
    const target = `${CONSUMET_BASE_URL}${ep}`;
    return fetch(target, {
      headers: { Accept: "application/json", "User-Agent": "Kyrox/1.0" },
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`${prov} ${res.status}`);
      return { provider: prov, body: await res.json() };
    });
  });

  const winner = await Promise.any(attempts);
  return new Response(JSON.stringify(winner.body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/consumet/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const url = new URL(request.url);

        if (CONSUMET_BASE_URL) {
          // NOTE: these helpers can throw (fetch TimeoutError / AggregateError).
          // They MUST be caught here — an uncaught throw propagates through the
          // request middleware and crashes the whole SSR render with a 500.
          try {
            // If provider is "race", fire all providers and return fastest
            const parts = splat.split("/").filter(Boolean);
            if (parts[1] === "race" && parts.length >= 2) {
              const category = parts[0];
              const action = parts.slice(2).join("/") || "info";
              return await raceExternal(category, action, url.searchParams);
            }
            return await proxyToExternal(request, splat);
          } catch (err) {
            const message = err instanceof Error ? err.message : "upstream failed";
            return new Response(JSON.stringify({ error: "consumet_unreachable", message }), {
              status: 502,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
        }

        try {
          const parts = splat.split("/").filter(Boolean);
          if (parts.length < 2) throw new Error("invalid path: /{category}/{provider}[/{action}]");

          const category = parts[0];
          const provider = parts[1];

          // If provider is "race", try all providers in parallel
          if (provider === "race") {
            const action = parts.slice(2).join("/") || "info";
            const result = await handleRace(category, action, url.searchParams, url);
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const action = parts.slice(2).join("/") || "search";
          const result = await handleRequest(category, provider, action, url.searchParams);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "request failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
