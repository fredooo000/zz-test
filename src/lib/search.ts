import type { MediaItem, MediaKind } from "./catalog";

async function jget<T>(url: string, timeoutMs = 8000): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}

const JIKAN = "https://api.jikan.moe/v4";
const ANILIST_GRAPHQL = "https://graphql.anilist.co";

type AniListMediaGQL = {
  id: number;
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

function gqlToItem(m: AniListMediaGQL, kind: "anime" | "movie"): MediaItem {
  const title = m.title.english || m.title.romaji || m.title.native || "Untitled";
  return {
    id: `${kind}:${m.id}`,
    title,
    kind,
    genre: (m.genres || []).slice(0, 2).join(" \u2022 ") || "Featured",
    badge: kind === "movie" ? "FILM" : m.episodes ? `EP ${m.episodes}` : m.format || "SERIES",
    year: m.seasonYear ?? undefined,
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : undefined,
    synopsis: (m.description || "").replace(/<[^>]+>/g, "").slice(0, 320),
    image: m.coverImage?.extraLarge || m.coverImage?.large || "",
    hero: m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || "",
  };
}

async function anilistSearch(
  query: string,
  wantMovie: boolean,
  perPage: number,
): Promise<MediaItem[]> {
  const gql = `query ($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id title { romaji english native } description coverImage { large extraLarge }
        bannerImage genres averageScore episodes seasonYear format
      }
    }
  }`;
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: query, perPage } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const media: AniListMediaGQL[] = json.data?.Page?.media || [];
    return media
      .filter((m) => (m.format === "MOVIE") === wantMovie)
      .map((m) => gqlToItem(m, wantMovie ? "movie" : "anime"));
  } catch {
    return [];
  }
}

type AniListMangaGQL = {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  description?: string;
  coverImage?: { large?: string; extraLarge?: string };
  genres?: string[];
  averageScore?: number;
  format?: string;
  countryOfOrigin?: string;
};

function anilistMangaToItem(m: AniListMangaGQL, kind: MediaKind): MediaItem {
  const title = m.title.english || m.title.romaji || m.title.native || "Untitled";
  return {
    id: `${kind}:${m.id}`,
    title,
    kind,
    genre: (m.genres || []).slice(0, 2).join(" \u2022 ") || "Manga",
    badge: m.format || "MANGA",
    year: undefined,
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : undefined,
    synopsis: (m.description || "").replace(/<[^>]+>/g, "").slice(0, 320),
    image: m.coverImage?.extraLarge || m.coverImage?.large || "",
  };
}

type JikanSearchResult = Array<{
  mal_id: number;
  title: string;
  title_english?: string;
  episodes?: number | null;
  images?: { jpg?: { large_image_url?: string } };
  score?: number;
  year?: number;
  synopsis?: string;
  genres?: Array<{ name: string }>;
  type?: string;
}>;

function toJikanItem(a: JikanSearchResult[0], kind: "anime" | "movie"): MediaItem {
  return {
    id: `${kind}:mal-${a.mal_id}`,
    title: a.title_english || a.title,
    kind,
    genre:
      (a.genres || [])
        .slice(0, 2)
        .map((g) => g.name)
        .join(" • ") || "Featured",
    badge: kind === "movie" ? "FILM" : a.episodes ? `EP ${a.episodes}` : "SERIES",
    year: a.year || undefined,
    rating: a.score || undefined,
    synopsis: (a.synopsis || "").replace(/<[^>]+>/g, "").slice(0, 320),
    image: a.images?.jpg?.large_image_url || "",
  };
}

const titleNorm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

function dedupe(all: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return all.filter((item) => {
    const key = titleNorm(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchAnimeFromBoth(
  query: string,
  kind: "anime" | "movie",
  perPage = 10,
): Promise<MediaItem[]> {
  // Primary source is AniList GraphQL (fast + reliable); Jikan supplements gaps.
  const anilistTask = anilistSearch(query, kind === "movie", perPage);

  const jikanTask = jget<{ data: JikanSearchResult }>(
    `${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=${perPage}&order_by=score&sort=desc`,
    4000,
  )
    .then((data) =>
      (data.data || [])
        .filter((a) => (kind === "movie" ? a.type === "Movie" : a.type === "TV"))
        .map((a) => toJikanItem(a, kind)),
    )
    .catch(() => [] as MediaItem[]);

  const [anilist, jikan] = await Promise.all([anilistTask, jikanTask]);
  // Prefer AniList results (canonical IDs used by the stream servers).
  return dedupe([...anilist, ...jikan]).slice(0, perPage);
}

export async function searchAnime(query: string): Promise<MediaItem[]> {
  return fetchAnimeFromBoth(query, "anime");
}

export async function searchMovies(query: string): Promise<MediaItem[]> {
  return fetchAnimeFromBoth(query, "movie");
}

async function searchAniListManga(
  query: string,
  kind: MediaKind,
  perPage = 10,
): Promise<MediaItem[]> {
  const gql = `query ($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: MANGA, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id title { romaji english native } description coverImage { large extraLarge }
        genres averageScore format countryOfOrigin
      }
    }
  }`;
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: query, perPage } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const media: AniListMangaGQL[] = json.data?.Page?.media || [];
    return media.map((m) => anilistMangaToItem(m, kind));
  } catch {
    return [];
  }
}

export async function searchManga(query: string): Promise<MediaItem[]> {
  return searchAniListManga(query, "manga");
}

export async function searchManhwa(query: string): Promise<MediaItem[]> {
  return searchAniListManga(query, "manhwa");
}

export async function searchTv(query: string): Promise<MediaItem[]> {
  try {
    const { searchTmdb } = await import("./tmdb");
    return searchTmdb(query, "tv", 12);
  } catch {
    return [];
  }
}

export async function searchAll(query: string): Promise<MediaItem[]> {
  const [anime, manga, movies, tv] = await Promise.all([
    searchAnime(query).catch(() => [] as MediaItem[]),
    searchAniListManga(query, "manga").catch(() => [] as MediaItem[]),
    searchMovies(query).catch(() => [] as MediaItem[]),
    searchTv(query).catch(() => [] as MediaItem[]),
  ]);
  return [...anime, ...manga, ...movies, ...tv];
}

export type SearchKind = "all" | "anime" | "manga" | "manhwa" | "movie" | "tv";

export const SEARCH_FN: Record<SearchKind, (q: string) => Promise<MediaItem[]>> = {
  all: searchAll,
  anime: searchAnime,
  manga: searchManga,
  manhwa: searchManhwa,
  movie: searchMovies,
  tv: searchTv,
};
