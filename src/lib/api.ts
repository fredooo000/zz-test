import type { MediaItem, MediaKind } from "./catalog";
import { fetchAnikotoSeries } from "./anikoto";
import { fetchMegaPlayAnime } from "./megaplay";

const ORIGIN = typeof window === "undefined" ? "" : "";
const CONSUMET = `${ORIGIN}/api/public/consumet`;
const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const FETCH_CACHE = new Map<string, { data: any; at: number }>();
const FETCH_CACHE_TTL = 60_000;

async function jget<T>(url: string, timeoutMs?: number): Promise<T> {
  // Client-side cache
  const cached = FETCH_CACHE.get(url);
  if (cached && Date.now() - cached.at < FETCH_CACHE_TTL) {
    return cached.data as T;
  }
  const r = await fetch(url, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const data = await r.json();
  FETCH_CACHE.set(url, { data, at: Date.now() });
  return data as T;
}

// ─── Helpers ────────────────────────────────────────────────
export function cleanSynopsis(text: string, maxLen = 320): string {
  let s = text
    // remove HTML tags
    .replace(/<[^>]+>/g, "")
    // remove markdown links: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
    // remove bare URLs
    .replace(/https?:\/\/\S+/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/\s+\S*$/, "") + "\u2026";
  return s;
}

// ─── Anime / Movies via Consumet (discovery) ────────────────
type AnilistItem = {
  id: string;
  title: { romaji?: string; english?: string; native?: string } | string;
  image: string;
  cover?: string;
  description?: string;
  rating?: number;
  releaseDate?: string | number;
  genres?: string[];
  type?: string;
  totalEpisodes?: number;
};

// ─── AniList GraphQL (fast, reliable browse source) ─────────
// The public Consumet mirrors are slow and frequently down, which made every
// listing crawl. AniList's own GraphQL API is a single fast request, so all
// browsing/search/discovery now goes straight to it.
type AniListMediaGQL = {
  id: number;
  idMal?: number | null;
  title: { romaji?: string; english?: string; native?: string };
  description?: string;
  coverImage?: { large?: string; extraLarge?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number | null;
  seasonYear?: number;
  format?: string;
};

const AL_MEDIA_FIELDS =
  "id idMal title { romaji english native } description coverImage { large extraLarge } bannerImage genres averageScore episodes seasonYear format";

async function anilistGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | undefined> {
  const cacheKey = `algql:${query.length}:${JSON.stringify(variables)}`;
  if (typeof window !== "undefined") {
    try {
      const c = sessionStorage.getItem(cacheKey);
      if (c) return JSON.parse(c) as T;
    } catch {}
  }
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    const data = json.data as T | undefined;
    if (data && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {}
    }
    return data;
  } catch {
    return undefined;
  }
}

function gqlToItem(m: AniListMediaGQL, kind: MediaKind): MediaItem {
  const title = m.title.english || m.title.romaji || m.title.native || "Untitled";
  return {
    id: `${kind}:${m.id}`,
    title,
    kind,
    genre: (m.genres || []).slice(0, 2).join(" \u2022 ") || "Featured",
    badge: kind === "movie" ? "FILM" : m.episodes ? `EP ${m.episodes}` : m.format || "SERIES",
    year: m.seasonYear ?? undefined,
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : undefined,
    synopsis: cleanSynopsis(m.description || ""),
    image: m.coverImage?.extraLarge || m.coverImage?.large || "",
    hero: m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || "",
  };
}

async function anilistBrowse(variables: {
  sort: string[];
  page: number;
  perPage: number;
  format?: string;
  season?: string;
  seasonYear?: number;
}): Promise<AniListMediaGQL[]> {
  const query = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $format: MediaFormat, $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: $sort, type: ANIME, format: $format, season: $season, seasonYear: $seasonYear, isAdult: false) { ${AL_MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistGql<{ Page: { media: AniListMediaGQL[] } }>(query, variables);
  return data?.Page?.media || [];
}

export async function fetchTrendingAnime(
  page = 1,
  perPage = 20,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const media = await anilistBrowse({ sort: ["TRENDING_DESC", "POPULARITY_DESC"], page, perPage });
  const items = media.filter((m) => m.format !== "MOVIE").map((m) => gqlToItem(m, "anime"));
  return { items, hasMore: media.length >= perPage };
}

export async function fetchPopularMovies(
  page = 1,
  perPage = 20,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const media = await anilistBrowse({ sort: ["POPULARITY_DESC"], page, perPage, format: "MOVIE" });
  const items = media.map((m) => gqlToItem(m, "movie"));
  return { items, hasMore: media.length >= perPage };
}

export async function fetchPopularAnime(
  page = 1,
  perPage = 20,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const media = await anilistBrowse({ sort: ["POPULARITY_DESC"], page, perPage });
  const items = media.filter((m) => m.format !== "MOVIE").map((m) => gqlToItem(m, "anime"));
  return { items, hasMore: media.length >= perPage };
}

export async function fetchTopRatedAnime(
  page = 1,
  perPage = 20,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const media = await anilistBrowse({ sort: ["SCORE_DESC"], page, perPage });
  const items = media.filter((m) => m.format !== "MOVIE").map((m) => gqlToItem(m, "anime"));
  return { items, hasMore: media.length >= perPage };
}

function currentSeason(): { season: string; year: number } {
  const m = new Date().getMonth();
  const season = m <= 2 ? "WINTER" : m <= 5 ? "SPRING" : m <= 8 ? "SUMMER" : "FALL";
  return { season, year: new Date().getFullYear() };
}

export async function fetchSeasonalAnime(
  page = 1,
  perPage = 20,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const { season, year } = currentSeason();
  const media = await anilistBrowse({
    sort: ["POPULARITY_DESC"],
    page,
    perPage,
    season,
    seasonYear: year,
  });
  const items = media.filter((m) => m.format !== "MOVIE").map((m) => gqlToItem(m, "anime"));
  return { items, hasMore: media.length >= perPage };
}

function resolveTitle(
  title: string | { romaji?: string; english?: string; native?: string },
): string {
  if (typeof title === "string") return title;
  return title.english || title.romaji || title.native || "Unknown";
}

// ─── Anime Info — multi-source fallback ─────────────────────
type AnilistGraphQLMedia = {
  id: number;
  idMal?: number | null;
  title: { romaji?: string; english?: string; native?: string };
  description?: string;
  coverImage?: { large?: string; extraLarge?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number | null;
  seasonYear?: number;
  format?: string;
};

async function fetchAnilistGraphQL(id: string): Promise<AnilistGraphQLMedia | undefined> {
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($id: Int) {
          Media(id: $id) {
            id idMal title { romaji english native }
            description coverImage { large extraLarge }
            bannerImage genres averageScore episodes seasonYear format
          }
        }`,
        variables: { id: parseInt(id) },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const json = await res.json();
    return json.data?.Media;
  } catch {}
}

// ─── Jikan API (MyAnimeList via Jikan v4) ────────────────────
const JIKAN = "https://api.jikan.moe/v4";

async function jikan<T>(path: string): Promise<T | undefined> {
  try {
    const r = await fetch(`${JIKAN}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return;
    return (await r.json()) as T;
  } catch {}
}

type JikanEpisode = { mal_id: number; title?: string; episode: number | null };
type JikanAnimeData = {
  mal_id: number;
  title: string;
  title_english?: string;
  episodes?: number | null;
  images?: { jpg?: { large_image_url?: string } };
  synopsis?: string;
  score?: number;
  genres?: Array<{ name: string }>;
  year?: number;
  season?: string;
};

async function fetchJikanEpisodes(
  malId: number,
): Promise<Array<{ number: number; title?: string }>> {
  const eps: Array<{ number: number; title?: string }> = [];
  let page = 1;
  while (page <= 5) {
    const data = await jikan<{ data: JikanEpisode[]; pagination: { has_next_page: boolean } }>(
      `/anime/${malId}/episodes?page=${page}`,
    );
    if (!data?.data?.length) break;
    for (const ep of data.data) {
      const num = ep.mal_id ?? eps.length + 1;
      eps.push({ number: num, title: ep.title });
    }
    if (!data.pagination?.has_next_page) break;
    page++;
  }
  return eps;
}

type ConsumetAnimeInfo = {
  id: string;
  title: AnilistItem["title"];
  description?: string;
  image: string;
  cover?: string;
  genres?: string[];
  rating?: number;
  totalEpisodes?: number;
  episodes?: Array<{ id: string; number: number; title?: string; image?: string }>;
};

async function fetchConsumetAnimeInfo(
  id: string,
  provider?: string,
  signal?: AbortSignal,
): Promise<ConsumetAnimeInfo> {
  const url = provider
    ? `${CONSUMET}/meta/anilist/info/${id}?provider=${provider}`
    : `${CONSUMET}/meta/anilist/info/${id}`;
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(6000) });
  return (await res.json()) as ConsumetAnimeInfo;
}

// Fire meta/anilist with a small set of known-working providers; return fastest.
// Previous versions fired 13+ providers at once, flooding Spacely and causing
// mass timeouts. The meta/anilist endpoint already aggregates all sources, so
// we just need the fastest path to episode data. Hianime removed (dead March 2026).
const ANIME_STREAM_PROVIDERS = ["gogoanime", "zoro", "animepahe", "9anime"];

async function raceConsumetAnimeInfo(id: string): Promise<ConsumetAnimeInfo | null> {
  // Fire ALL variants in parallel — no-provider (fastest path) + each provider.
  // Promise.any returns the fastest success. Max wait: ~6s.
  const attempts = [
    fetchConsumetAnimeInfo(id).catch(() => { throw new Error("default failed"); }),
    ...ANIME_STREAM_PROVIDERS.map((prov) =>
      fetchConsumetAnimeInfo(id, prov).catch(() => { throw new Error(`${prov} failed`); }),
    ),
  ];

  return Promise.any(attempts).catch(() => null);
}

type Ep = { id: string; number: number; title?: string };

// Pad an episode list up to a known total so under-reporting sources (which
// often only list already-aired/subbed episodes) still expose every episode.
// The stream servers build their URL from (sourceId, episodeNumber), so the
// synthesised entries are fully playable.
function padEpisodes(eps: Ep[], total: number): Ep[] {
  if (!total || total <= eps.length) return eps;
  const have = new Set(eps.map((e) => e.number));
  const out = [...eps];
  for (let n = 1; n <= total; n++) {
    if (!have.has(n)) out.push({ id: String(n), number: n });
  }
  return out.sort((a, b) => a.number - b.number);
}

type EpisodeSource = { id: string; totalEpisodes?: number; episodes: Ep[] };

async function raceEpisodeSources(id: string): Promise<EpisodeSource | null> {
  if (!/^\d+$/.test(id)) return null;

  const attempts: Promise<EpisodeSource>[] = [
    fetchMegaPlayAnime(id).then((m) => {
      if (!m?.episodes?.length) throw new Error("no megaplay eps");
      return {
        id: String(m.id),
        totalEpisodes: m.totalEpisodes,
        episodes: m.episodes.map((ep) => ({
          id: String(ep.embed_id ?? ep.id),
          number: ep.number,
          title: ep.title,
        })),
      };
    }).catch(() => { throw new Error("megaplay failed"); }),

    fetchAnikotoSeries(id).then((a) => {
      if (!a?.episodes?.length) throw new Error("no anikoto eps");
      return {
        id: a.id,
        totalEpisodes: a.total_episodes,
        episodes: a.episodes.map((ep) => ({
          id: String(ep.episode_embed_id),
          number: ep.episode_no,
          title: ep.title,
        })),
      };
    }).catch(() => { throw new Error("anikoto failed"); }),

    raceConsumetAnimeInfo(id).then((c) => {
      if (!c?.episodes?.length) throw new Error("no consumet eps");
      return {
        id: String(c.id),
        totalEpisodes: c.totalEpisodes,
        episodes: c.episodes.map((ep) => ({
          id: String(ep.id),
          number: ep.number,
          title: ep.title,
        })),
      };
    }).catch(() => { throw new Error("consumet failed"); }),
  ];

  return Promise.any(attempts).catch(() => null);
}

const ANIME_INFO_CACHE = new Map<string, any>();
const ANIME_CACHE_TTL = 5 * 60_000;

export async function fetchAnimeInfo(id: string) {
  const cached = ANIME_INFO_CACHE.get(id);
  if (cached && Date.now() - cached.at < ANIME_CACHE_TTL) {
    return cached.data;
  }

  // Fire metadata + episode sources in parallel.
  // Anilist GraphQL is fast (<1s), episode sources race at ~6s.
  const [media, episodes] = await Promise.all([
    fetchAnilistGraphQL(id).catch(() => undefined),
    raceEpisodeSources(id),
  ]);

  const plannedTotal = media?.episodes || 0;

  const buildResult = (eps: Ep[], totalOverride?: number) => {
    const result = {
      id: String(media?.id ?? id),
      title: resolveTitle(media?.title || { romaji: "Unknown" }),
      description: cleanSynopsis(media?.description || ""),
      image: media?.coverImage?.extraLarge || media?.coverImage?.large || "",
      cover: media?.bannerImage || "",
      genres: media?.genres || [],
      rating: media?.averageScore ? media.averageScore / 10 : undefined,
      totalEpisodes: totalOverride != null ? totalOverride : (plannedTotal || undefined),
      episodes: padEpisodes(eps, plannedTotal),
    };
    ANIME_INFO_CACHE.set(id, { data: result, at: Date.now() });
    return result;
  };

  if (episodes?.episodes?.length) {
    return buildResult(episodes.episodes, episodes.totalEpisodes);
  }

  if (media) {
    return buildResult([]);
  }

  throw new Error("Could not load anime info from any source.");
}

async function malToAnilist(malId: number): Promise<string | undefined> {
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($malId: Int) { Media(idMal: $malId) { id } }`,
        variables: { malId },
      }),
      signal: AbortSignal.timeout(4000),
    });
    const json = (await res.json()) as { data?: { Media?: { id: number } } };
    return json.data?.Media?.id ? String(json.data.Media.id) : undefined;
  } catch {
    return undefined;
  }
}

function scoreTitleMatch(title: string, query: string): number {
  const t = title.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  const normT = t.replace(/[^a-z0-9]/g, "");
  const normQ = q.replace(/[^a-z0-9]/g, "");
  // exact match (after normalization) → highest
  if (normT === normQ) return 5;
  // exact original match
  if (t === q) return 4;
  // exact word boundary match (e.g. "Bleach" matches "Bleach" but not "Bleacher")
  if (t.startsWith(q) && (t.length === q.length || /\s/.test(t[q.length]))) return 3;
  // starts with
  if (t.startsWith(q)) return 2;
  // includes at word boundary
  if (new RegExp(`\\b${q}\\b`).test(t)) return 1.5;
  // includes
  if (t.includes(q)) return 1;
  return 0;
}

export async function resolveAnimeTitle(
  query: string,
  kind: "anime" | "movie",
): Promise<{ id: string; title: string } | undefined> {
  const wantedMovie = kind === "movie";
  const normQuery = query.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Primary: AniList GraphQL search (single fast request).
  const gql = `query ($search: String) {
    Page(perPage: 15) {
      media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id format title { romaji english native }
      }
    }
  }`;
  const data = await anilistGql<{
    Page: {
      media: Array<{
        id: number;
        format?: string;
        title: { romaji?: string; english?: string; native?: string };
      }>;
    };
  }>(gql, { search: query });

  const candidates = (data?.Page?.media || []).filter(
    (m) => (m.format === "MOVIE") === wantedMovie,
  );
  // Also include candidates where format is undefined (might still match)
  const fuzzyCandidates = (data?.Page?.media || []).filter(
    (m) => m.format !== "MOVIE" || !wantedMovie,
  );
  const allCandidates = candidates.length ? candidates : fuzzyCandidates;

  if (allCandidates.length) {
    const scored = allCandidates.map((m) => {
      const en = m.title.english || "";
      const ro = m.title.romaji || "";
      const enNorm = en.toLowerCase().replace(/[^a-z0-9]/g, "");
      const roNorm = ro.toLowerCase().replace(/[^a-z0-9]/g, "");
      const enScore = scoreTitleMatch(en, query);
      const roScore = scoreTitleMatch(ro, query);
      const normBonus = enNorm === normQuery || roNorm === normQuery ? 1 : 0;
      return { m, score: Math.max(enScore, roScore) + normBonus };
    });
    const best = scored.reduce((a, b) => (a.score >= b.score ? a : b));
    // Lowered threshold: accept if >= 1 (partial match or starts with)
    if (best.score >= 1) {
      return { id: String(best.m.id), title: best.m.title.english || best.m.title.romaji || query };
    }
  }

  // Fallback: take first candidate anyway if format is close
  if (candidates.length) {
    return {
      id: String(candidates[0].id),
      title: candidates[0].title.english || candidates[0].title.romaji || query,
    };
  }

  // Fallback: Jikan search → MAL id → AniList id.
  const jikan = await jget<{
    data: Array<{
      mal_id: number;
      title: string;
      title_english?: string;
      type?: string;
      score?: number;
    }>;
  }>(`${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=5`, 4000).catch(() => undefined);
  const jCands = (jikan?.data || []).filter((item) => (item.type === "Movie") === wantedMovie);
  if (jCands.length) {
    const scored = jCands.map((item) => ({
      item,
      score: Math.max(
        scoreTitleMatch(item.title, query),
        scoreTitleMatch(item.title_english || "", query),
      ),
    }));
    const best = scored.reduce((a, b) => (a.score >= b.score ? a : b));
    // Lowered threshold to 1
    if (best.score >= 1) {
      const anilistId = await malToAnilist(best.item.mal_id);
      if (anilistId) return { id: anilistId, title: best.item.title_english || best.item.title };
    }
  }

  // Last resort: try all Jikan results without type filtering
  if (jikan?.data?.length) {
    for (const item of jikan.data) {
      const anilistId = await malToAnilist(item.mal_id);
      if (anilistId) return { id: anilistId, title: item.title_english || item.title };
    }
  }

  return undefined;
}

// ─── TMDB-based Movie / TV info (via Consumet TMDB provider) ──

export async function fetchTMDBInfo(
  id: string,
  type: "movie" | "tv",
): Promise<
  | {
      id: number;
      title: string;
      image?: string;
      cover?: string;
      description?: string;
      rating?: number;
      genres?: string[];
      episodes?: Array<{ id: string; number: number; title?: string }>;
    }
  | undefined
> {
  try {
    const data = await jget<{
      id: number;
      title?: string;
      name?: string;
      image?: string;
      cover?: string;
      description?: string;
      rating?: number;
      genres?: string[];
      episodes?: Array<{ id: string; number: number; title?: string }>;
    }>(`${CONSUMET}/meta/tmdb/info?id=${id}&type=${type}`, 6000);
    if (!data) return;
    return {
      id: data.id,
      title: data.title || data.name || "Unknown",
      image: data.image,
      cover: data.cover,
      description: cleanSynopsis(data.description || ""),
      rating: data.rating,
      genres: data.genres,
      episodes: data.episodes,
    };
  } catch {
    return undefined;
  }
}

export async function resolveRealMovieOrTV(query: string, type: "movie" | "tv") {
  try {
    const data = await jget<{
      results: Array<{ id: number; title?: string; name?: string; image?: string }>;
    }>(`${CONSUMET}/meta/tmdb/${encodeURIComponent(query)}?page=1&type=${type}`, 5000);
    return data.results?.[0];
  } catch {
    return undefined;
  }
}

// ─── Manga / Manhwa via Mangafire ────────────────────────────

// ─── Manga / Manhwa via Mangafire ────────────────────────────

export async function fetchManga(page = 1): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const res = await fetch(`/api/manga/browse?type=manga&page=${page}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { items: [], hasMore: false };
  return res.json();
}

export async function fetchManhwa(page = 1): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  // Manhwa is sourced from AsuraScans (dedicated manhwa catalogue with covers,
  // ratings and chapter counts), not the mangafire scrape used for manga.
  const res = await fetch(`/api/manga/asura?page=${page}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { items: [], hasMore: false };
  return res.json();
}

// AsuraScans-backed info for a manhwa slug (title, cover, chapters). The chapter
// ids are "<public-slug>/<n>", which the reader resolves back to AsuraScans.
export async function fetchAsuraInfo(slug: string): Promise<MangaInfoResult> {
  const res = await fetch(`/api/manga/info/${encodeURIComponent(slug)}?source=asurascan`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AsuraScan ${res.status} for ${slug}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function resolveMangaTitle(
  query: string,
  kind: "manga" | "manhwa",
): Promise<{ id: string; source?: string } | undefined> {
  try {
    const res = await fetch(`/api/manga/resolve?title=${encodeURIComponent(query)}&kind=${kind}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

async function fetchFromResolvedSlug(slug: string): Promise<{ data: any; source: string }> {
  const res = await fetch(`/api/manga/info/${encodeURIComponent(slug)}?source=mangafire`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Mangafire ${res.status} for ${slug}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { data, source: "mangafire" };
}

async function fetchFromAsuraScanSlug(slug: string): Promise<{ data: any; source: string }> {
  const res = await fetch(`/api/manga/info/${encodeURIComponent(slug)}?source=asurascan`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AsuraScan ${res.status} for ${slug}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { data, source: "asurascan" };
}

async function fetchFromConsumetSlug(
  slug: string,
  source: string,
): Promise<{ data: any; source: string }> {
  const provider = source.startsWith("consumet-") ? source.slice(9) : "mangakakalot";
  const res = await fetch(
    `/api/manga/info/${encodeURIComponent(slug)}?source=consumet-${provider}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) throw new Error(`${provider} ${res.status} for ${slug}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { data, source: `consumet-${provider}` };
}


async function fetchChaptersFromAllSources(
  id: string,
  slug: string,
  anilistTitle?: string,
  anilistAltTitle?: string,
): Promise<UnifiedChapter[]> {
  const titles = [
    anilistTitle,
    anilistAltTitle,
    slug.replace(/[._-]/g, " ").replace(/\d+$/, "").trim(),
  ].filter((t): t is string => !!t && t.length > 2);
  const dedupedTitles = [...new Set(titles)];

  // Fetch from ALL sources in parallel, then merge.
  const results = await Promise.allSettled([
    // MangaDex
    dedupedTitles.length > 0
      ? fetchMangaDexChapters(dedupedTitles).then((r) => r?.chapters ?? [])
      : Promise.resolve([] as UnifiedChapter[]),
    // MangaFire (non-numeric slugs)
    !/^\d+$/.test(slug)
      ? fetchFromResolvedSlug(slug).then((r) => (r.data.chapters ?? []) as UnifiedChapter[])
      : Promise.resolve([] as UnifiedChapter[]),
    // Consumet
    dedupedTitles.length > 0
      ? fetchFromConsumetByTitle(dedupedTitles[0], "mangakakalot").then(
          (r) => (r.data.chapters ?? []) as UnifiedChapter[],
        )
      : Promise.resolve([] as UnifiedChapter[]),
  ]);

  // Merge all chapters from all sources, deduplicating by chapter number.
  const seenChapters = new Map<string, UnifiedChapter>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const ch of result.value) {
      const num = ch.attributes?.chapter || "0";
      if (!seenChapters.has(num)) {
        seenChapters.set(num, ch);
      }
    }
  }

  const merged = Array.from(seenChapters.values());
  return merged.sort((a, b) => {
    const an = parseFloat(a.attributes?.chapter || "0");
    const bn = parseFloat(b.attributes?.chapter || "0");
    return bn - an; // newest first
  });
}

async function fetchFromConsumetByTitle(
  title: string,
  provider: string,
): Promise<{ data: any; source: string }> {
  const base = typeof process !== "undefined" && process.env?.CONSUMET_BASE_URL
    ? process.env.CONSUMET_BASE_URL
    : "https://api.spacely.tech";
  // Search provider by title
  const searchRes = await fetch(
    `${base}/manga/${provider}/${encodeURIComponent(title)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!searchRes.ok) throw new Error(`${provider} search ${searchRes.status}`);
  const searchData = await searchRes.json();
  if (searchData.error) throw new Error(searchData.error);
  if (!searchData.results?.length) throw new Error(`${provider} no results`);
  const found = searchData.results[0];
  if (!found.id) throw new Error(`${provider} result has no id`);
  // Fetch info using the provider-specific ID
  const infoRes = await fetch(
    `${base}/manga/${provider}/info?id=${encodeURIComponent(found.id)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!infoRes.ok) throw new Error(`${provider} info ${infoRes.status}`);
  const infoData = await infoRes.json();
  if (infoData.error) throw new Error(infoData.error);
  return { data: infoData, source: `consumet-${provider}` };
}

type UnifiedChapter = { id: string; attributes: { chapter?: string; title?: string } };

type MangaInfoResult = {
  title: string;
  description?: string;
  image?: string;
  cover?: string;
  genres?: string[];
  rating?: number;
  status?: string;
  type?: string;
  chapters: UnifiedChapter[];
};

const MANGA_INFO_CACHE = new Map<string, { data: MangaInfoResult; at: number }>();
const MANGA_CACHE_TTL = 15 * 60_000; // 15 min (was 5 min — chapter lists are stable)

function cacheMangaInfo(id: string, data: MangaInfoResult) {
  MANGA_INFO_CACHE.set(id, { data, at: Date.now() });
}

function buildMangaFallback(m: any): MangaInfoResult | undefined {
  if (!m) return;
  const title = resolveTitle(m.title || { romaji: "Unknown" });
  return {
    title,
    description: cleanSynopsis(m.description || ""),
    image: m.coverImage?.extraLarge || m.coverImage?.large || "",
    cover: m.bannerImage || "",
    genres: m.genres || [],
    rating: m.averageScore ? m.averageScore / 10 : undefined,
    status: m.status,
    type: m.format,
    chapters: [],
  };
}

async function fetchMangaDexChapters(
  titles: string[],
): Promise<{ chapters: UnifiedChapter[]; image?: string } | undefined> {
  for (const title of titles) {
    if (!title || title.length < 2) continue;
    try {
      const searchRes = await fetch(
        `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&includes[]=cover_art`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const manga = searchData?.data?.[0];
      if (!manga) continue;

    const mangaId = manga.id;
    const coverRel = (manga.relationships || []).find((r: any) => r.type === "cover_art");
    const image = coverRel
      ? `https://uploads.mangadex.org/covers/${mangaId}/${coverRel.attributes?.fileName}.256.jpg`
      : undefined;

    const feedRes = await fetch(
      `https://api.mangadex.org/manga/${mangaId}/feed?limit=500&order[chapter]=desc&translatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      },
    );
    const feedData = feedRes.ok ? await feedRes.json() : { data: [] };
    const chapters: UnifiedChapter[] = (feedData.data || []).map((ch: any) => ({
      id: ch.id,
      attributes: {
        chapter: ch.attributes?.chapter || "",
        title: ch.attributes?.title || undefined,
      },
    }));

    return { chapters, image };
  } catch {
    continue;
  }
  }
}

async function fetchMangaDexChapterPages(chapterId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const { baseUrl, chapter } = data;
    const hash = chapter?.hash;
    if (!baseUrl || !hash) return [];
    return (chapter.data || []).map((page: string) => `${baseUrl}/data/${hash}/${page}`);
  } catch {
    return [];
  }
}

export async function fetchMangaInfo(id: string): Promise<MangaInfoResult> {
  // ── Cache hit ─────────────────────────────────────────────────────────────
  const cached = MANGA_INFO_CACHE.get(id);
  if (cached && Date.now() - cached.at < MANGA_CACHE_TTL) {
    return cached.data;
  }

  let slug = id;
  let resolvedSource: string | undefined;

  // ── For numeric IDs: resolve slug + fetch AniList meta IN PARALLEL ────────
  // Old code did these sequentially: resolve (15s timeout) → then AniList (5s).
  // Now both fire at the same time, so total time ≈ max(resolve, anilist) not sum.
  let anilistTitle: string | undefined;
  let anilistAltTitle: string | undefined;
  let anilistFallback: MangaInfoResult | undefined;

  if (/^\d+$/.test(id)) {
    const [resolveResult, anilistResult] = await Promise.allSettled([
      // Resolve slug from AniList ID
      resolveMangaTitleByAnilistId(id),
      // Fetch AniList metadata for fallback
      fetch(ANILIST_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id) { title { romaji english native } description coverImage { extraLarge large } bannerImage genres averageScore format status } }`,
          variables: { id: parseInt(id) },
        }),
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => json?.data?.Media ?? null),
    ]);

    if (resolveResult.status === "fulfilled" && resolveResult.value) {
      slug = resolveResult.value.id;
      resolvedSource = resolveResult.value.source;
    }

    if (anilistResult.status === "fulfilled" && anilistResult.value) {
      const m = anilistResult.value;
      anilistTitle = m.title?.english || m.title?.romaji || m.title?.native;
      anilistAltTitle = m.title?.romaji && m.title?.english ? m.title?.romaji : undefined;
      anilistFallback = buildMangaFallback(m) ?? undefined;
      if (anilistFallback) cacheMangaInfo(id, anilistFallback); // store early so UI can show something
    }
  }

  // ── Fetch source info + chapters in parallel ───────────────────────────────
  // Old code fetched source info, waited for it, then fetched chapters.
  // Now both run concurrently.
  try {
    let infoPromise: Promise<{ data: any; source?: string }>;

    if (resolvedSource === "mangafire") {
      infoPromise = fetchFromResolvedSlug(slug);
    } else if (resolvedSource === "asurascan") {
      infoPromise = fetchFromAsuraScanSlug(slug);
    } else if (resolvedSource?.startsWith("consumet-")) {
      const prov = resolvedSource.slice(9);
      infoPromise = fetchFromConsumetSlug(slug, `consumet-${prov}`);
    } else {
      // Fuzzy consumet-by-title fallbacks — used ONLY if an exact slug match
      // fails. A fuzzy title search can return a DIFFERENT series, which is what
      // caused some manga to show the wrong name/cover while chapters (looked up
      // separately by the real title) were still correct.
      const consumetTitles = [anilistTitle, anilistAltTitle, id.replace(/[._-]/g, " ").replace(/\d+$/, "").trim()]
        .filter((t): t is string => !!t && t.length > 2);
      const fuzzyAttempts = (): Promise<{ data: any; source?: string }> => {
        const attempts: Promise<{ data: any; source?: string }>[] = [];
        for (const prov of ["mangakakalot", "comick", "asurascans"]) {
          for (const t of consumetTitles) {
            attempts.push(fetchFromConsumetByTitle(t, prov).catch(() => { throw new Error(prov); }));
          }
        }
        return attempts.length > 0
          ? Promise.any(attempts)
          : Promise.reject(new Error("no attempts"));
      };

      // Prefer the EXACT mangafire slug for the display title/cover; only fall
      // back to fuzzy title matches if that exact lookup fails.
      infoPromise = !/^\d+$/.test(slug)
        ? fetchFromResolvedSlug(slug).catch(() => fuzzyAttempts())
        : fuzzyAttempts();
    }

    // Resolve the source info FIRST so we can use its real title for chapter
    // lookups. Slug-derived titles (e.g. "mousou senseii 42wjo") are unreliable
    // for MangaDex/Consumet search; the real title ("Mousou Sensei") matches.
    // MangaFire's chapter AJAX is currently unreliable (returns 0 chapters), so
    // we no longer depend on it for the chapter list.
    const infoResult = await infoPromise.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason }),
    );

    const sourceData = infoResult.status === "fulfilled" ? infoResult.value.data : undefined;
    const sourceChapters: UnifiedChapter[] = Array.isArray(sourceData?.chapters)
      ? sourceData.chapters
      : [];
    const realTitle =
      anilistTitle ?? (typeof sourceData?.title === "string" ? sourceData.title : undefined);

    // Merge chapters from the source info with chapters fetched from all other
    // sources (MangaDex + MangaFire + Consumet) to get the most complete list.
    const allSourceChapters = await fetchChaptersFromAllSources(id, slug, realTitle, anilistAltTitle);
    const seenChapters = new Map<string, UnifiedChapter>();
    for (const ch of [...sourceChapters, ...allSourceChapters]) {
      const num = ch.attributes?.chapter || ch.id;
      if (!seenChapters.has(num)) {
        seenChapters.set(num, ch);
      }
    }
    let chapters: UnifiedChapter[] = Array.from(seenChapters.values());
    if (chapters.length === 0) {
      chapters = sourceChapters.length > 0 ? sourceChapters : allSourceChapters;
    }
    chapters.sort((a, b) => {
      const an = parseFloat(a.attributes?.chapter || "0");
      const bn = parseFloat(b.attributes?.chapter || "0");
      return bn - an;
    });

    if (infoResult.status === "fulfilled") {
      const data = { ...infoResult.value.data };
      if (chapters.length > 0) data.chapters = chapters;
      cacheMangaInfo(id, data);
      return data;
    }

    // Source info failed but we recovered chapters — merge onto a base record.
    if (chapters.length > 0) {
      const base = anilistFallback ?? { title: realTitle ?? id, chapters: [] as UnifiedChapter[] };
      const merged = { ...base, chapters };
      cacheMangaInfo(id, merged);
      return merged;
    }
  } catch {}

  // ── Last resort: return AniList fallback if available ─────────────────────
  const stillCached = MANGA_INFO_CACHE.get(id);
  if (stillCached?.data) return stillCached.data;

  throw new Error("Could not load manga info from any source.");
}

async function resolveMangaTitleByAnilistId(
  anilistId: string,
): Promise<{ id: string; source?: string } | undefined> {
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($id: Int) { Media(id: $id) { title { romaji english native } format } }`,
        variables: { id: parseInt(anilistId) },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    const media = json.data?.Media;
    const title = media?.title?.english || media?.title?.romaji;
    if (!title) return undefined;

    // Map Anilist format → resolve kind
    const fmt = media?.format || "";
    const kind = fmt === "MANHWA" || fmt === "MANHUA" ? "manhwa" : "manga";

    const resolveRes = await fetch(
      `/api/manga/resolve?title=${encodeURIComponent(title)}&kind=${kind}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!resolveRes.ok) {
      // Fallback: try the other kind
      const other = kind === "manhwa" ? "manga" : "manhwa";
      const retry = await fetch(
        `/api/manga/resolve?title=${encodeURIComponent(title)}&kind=${other}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!retry.ok) return undefined;
      return retry.json();
    }
    return resolveRes.json();
  } catch {
    return undefined;
  }
}

export async function fetchChapterPages(
  chapterId: string,
  source = "mangafire",
): Promise<string[]> {
  const res = await fetch(`/api/manga/chapter/${encodeURIComponent(chapterId)}?source=${source}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Manga ${res.status} for chapter ${chapterId}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.pages;
}

async function fetchConsumetChapterPages(
  chapterId: string,
  provider = "mangakakalot",
): Promise<string[]> {
  return fetchChapterPages(chapterId, `consumet-${provider}`);
}

export async function fetchChapterPagesWithFallback(chapterId: string): Promise<string[]> {
  // MangaDex chapter ids are UUIDs
  const isMangaDexId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);
  const isAsuraId = chapterId.includes("/") && !chapterId.includes("?");

  // Try all relevant sources in parallel, return the first that succeeds.
  const attempts: Promise<string[]>[] = [];

  if (isMangaDexId) {
    attempts.push(fetchMangaDexChapterPages(chapterId));
  }
  if (isAsuraId) {
    attempts.push(fetchChapterPages(chapterId, "asurascan"));
  }
  attempts.push(
    fetchChapterPages(chapterId, "mangafire"),
    fetchConsumetChapterPages(chapterId),
  );
  if (!isMangaDexId) {
    attempts.push(fetchMangaDexChapterPages(chapterId));
  }

  // Return first successful result
  const results = await Promise.allSettled(attempts);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.length > 0) return r.value;
  }
  throw new Error("Could not load chapter from any source.");
}
