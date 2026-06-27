import type { MediaItem } from "./catalog";

// All TMDB calls go through our same-origin proxy, which injects the API key
// server-side so it never ships in the client bundle.
const TMDB = "/api/public/tmdb";
const IMG = "https://image.tmdb.org/t/p";

export const tmdbPoster = (path?: string | null, size: "w342" | "w500" | "w780" = "w500") =>
  path ? `${IMG}/${size}${path}` : "";
export const tmdbBackdrop = (
  path?: string | null,
  size: "w780" | "w1280" | "original" = "w1280",
) => (path ? `${IMG}/${size}${path}` : "");

// TMDB genre id → name (movies + TV share most ids).
const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function genreNames(ids?: number[], objs?: Array<{ id: number; name: string }>): string[] {
  if (objs?.length) return objs.map((g) => g.name);
  return (ids || []).map((id) => GENRES[id]).filter(Boolean);
}

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type?: string;
};

async function tget<T>(path: string, timeoutMs = 8000): Promise<T> {
  const r = await fetch(`${TMDB}/${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`TMDB ${r.status} ${path}`);
  return r.json() as Promise<T>;
}

function resultToItem(r: TmdbResult, kind: "movie" | "tv"): MediaItem {
  const title = r.title || r.name || "Untitled";
  const date = r.release_date || r.first_air_date;
  const genres = genreNames(r.genre_ids);
  return {
    // Movies route through /title/$id; TV through /tv/$id (handled by MediaCard).
    id: kind === "movie" ? `movie:tmdb-${r.id}` : `tv:tmdb-${r.id}`,
    title,
    kind,
    genre: genres.slice(0, 2).join(" \u2022 ") || (kind === "tv" ? "Series" : "Film"),
    badge: kind === "movie" ? "FILM" : "TV",
    year: date ? Number(date.slice(0, 4)) : undefined,
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
    synopsis: (r.overview || "").slice(0, 320),
    image: tmdbPoster(r.poster_path),
    hero: tmdbBackdrop(r.backdrop_path),
  };
}

export type MovieCategory = "trending" | "popular" | "top_rated" | "now_playing";
export type TvCategory = "trending" | "popular" | "top_rated" | "on_the_air";

function moviePath(cat: MovieCategory, page: number): string {
  if (cat === "trending") return `trending/movie/week?page=${page}`;
  return `movie/${cat}?page=${page}`;
}
function tvPath(cat: TvCategory, page: number): string {
  if (cat === "trending") return `trending/tv/week?page=${page}`;
  return `tv/${cat}?page=${page}`;
}

export async function fetchTmdbMovies(
  cat: MovieCategory = "popular",
  page = 1,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const data = await tget<{ results: TmdbResult[]; total_pages: number }>(moviePath(cat, page));
  const items = (data.results || [])
    .filter((r) => r.poster_path)
    .map((r) => resultToItem(r, "movie"));
  return { items, hasMore: page < (data.total_pages || 1) };
}

export async function fetchTmdbTv(
  cat: TvCategory = "popular",
  page = 1,
): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const data = await tget<{ results: TmdbResult[]; total_pages: number }>(tvPath(cat, page));
  const items = (data.results || []).filter((r) => r.poster_path).map((r) => resultToItem(r, "tv"));
  return { items, hasMore: page < (data.total_pages || 1) };
}

export async function searchTmdb(
  query: string,
  kind: "movie" | "tv",
  perPage = 12,
): Promise<MediaItem[]> {
  try {
    const data = await tget<{ results: TmdbResult[] }>(
      `search/${kind}?query=${encodeURIComponent(query)}&page=1`,
      6000,
    );
    return (data.results || [])
      .filter((r) => r.poster_path)
      .slice(0, perPage)
      .map((r) => resultToItem(r, kind));
  } catch {
    return [];
  }
}

// Resolve a free-text title to a TMDB id (used when a catalog item has no id).
export async function resolveTmdbId(
  query: string,
  kind: "movie" | "tv",
): Promise<number | undefined> {
  try {
    const data = await tget<{ results: TmdbResult[] }>(
      `search/${kind}?query=${encodeURIComponent(query)}&page=1`,
      6000,
    );
    return data.results?.[0]?.id;
  } catch {
    return undefined;
  }
}

export interface TmdbSeason {
  season: number;
  name: string;
  episodeCount: number;
}

export interface TmdbDetail {
  id: number;
  kind: "movie" | "tv";
  title: string;
  image: string;
  cover: string;
  description: string;
  rating?: number;
  year?: number;
  genres: string[];
  runtime?: number;
  tagline?: string;
  seasons?: TmdbSeason[];
}

export async function fetchTmdbDetail(
  id: number | string,
  kind: "movie" | "tv",
): Promise<TmdbDetail> {
  const data = await tget<{
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    tagline?: string;
    genres?: Array<{ id: number; name: string }>;
    number_of_seasons?: number;
    seasons?: Array<{ season_number: number; name: string; episode_count: number }>;
  }>(`${kind}/${id}`);

  const date = data.release_date || data.first_air_date;
  const seasons: TmdbSeason[] | undefined =
    kind === "tv"
      ? (data.seasons || [])
          .filter((s) => s.season_number >= 1 && s.episode_count > 0)
          .map((s) => ({ season: s.season_number, name: s.name, episodeCount: s.episode_count }))
      : undefined;

  return {
    id: data.id,
    kind,
    title: data.title || data.name || "Untitled",
    image: tmdbPoster(data.poster_path),
    cover: tmdbBackdrop(data.backdrop_path),
    description: (data.overview || "").trim(),
    rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : undefined,
    year: date ? Number(date.slice(0, 4)) : undefined,
    genres: genreNames(undefined, data.genres),
    runtime: data.runtime || undefined,
    tagline: data.tagline || undefined,
    seasons,
  };
}

export interface TmdbEpisode {
  id: number;
  number: number;
  title?: string;
  season: number;
  still?: string;
}

export async function fetchTmdbSeasonEpisodes(
  tvId: number,
  seasonNumber: number,
): Promise<TmdbEpisode[]> {
  try {
    const data = await tget<{
      episodes?: Array<{
        id: number;
        episode_number: number;
        name?: string;
        still_path?: string | null;
      }>;
    }>(`tv/${tvId}/season/${seasonNumber}`, 6000);
    return (data.episodes || []).map((ep) => ({
      id: ep.id,
      number: ep.episode_number,
      title: ep.name,
      season: seasonNumber,
      still: ep.still_path ? tmdbPoster(ep.still_path, "w342") : undefined,
    }));
  } catch {
    return [];
  }
}

export async function fetchTmdbAllEpisodes(tvId: number): Promise<{
  episodes: TmdbEpisode[];
  seasons: TmdbSeason[];
}> {
  const detail = await fetchTmdbDetail(tvId, "tv");
  const seasonList = detail.seasons || [];
  const seasonEps = await Promise.all(
    seasonList.map((s) => fetchTmdbSeasonEpisodes(tvId, s.season)),
  );
  return {
    episodes: seasonEps.flat().sort((a, b) => a.number - b.number),
    seasons: seasonList,
  };
}

// Parse a TMDB id out of an internal media id like "movie:tmdb-693134",
// "tv:tmdb-1396", "tmdb-1396", or a bare numeric id.
export function parseTmdbId(rawId: string): number | undefined {
  const m = rawId.match(/tmdb-(\d+)/);
  if (m) return Number(m[1]);
  const n = Number(rawId.replace(/^(movie|tv):/, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
