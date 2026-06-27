import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { byKind, SPOTLIGHT } from "@/lib/catalog";
import type { MediaItem, MediaKind } from "@/lib/catalog";
import { filterExplicit, isExplicitFilterOn } from "@/lib/settings";
import {
  fetchTrendingAnime,
  fetchPopularAnime,
  fetchTopRatedAnime,
  fetchSeasonalAnime,
  fetchManga,
  fetchManhwa,
} from "@/lib/api";
import { fetchTmdbMovies, fetchTmdbTv, type MovieCategory, type TvCategory } from "@/lib/tmdb";

const PAGE = 20;

const fetchers: Record<
  MediaKind,
  (page: number) => Promise<{ items: MediaItem[]; hasMore: boolean }>
> = {
  anime: (p) => fetchTrendingAnime(p, 20),
  movie: (p) => fetchTmdbMovies("popular", p),
  manga: (p) => fetchManga(p),
  manhwa: (p) => fetchManhwa(p),
  tv: (p) => fetchTmdbTv("popular", p),
};

// Per-kind stale times.
// manga/manhwa: 10min — browse grids are scraped from mangafire.to via your
//   Worker. Each miss costs a live scrape. Navigating Manga → Library → Manga
//   within 10min should reuse the cache, not re-scrape.
// anime/movie/tv: 5min — AniList and TMDB are faster, slightly more dynamic.
const STALE_TIMES: Record<MediaKind, number> = {
  manga: 10 * 60_000,
  manhwa: 10 * 60_000,
  anime: 5 * 60_000,
  movie: 5 * 60_000,
  tv: 5 * 60_000,
};

export function useCatalog(kind: MediaKind) {
  // Include the filter state in the key so toggling it re-renders the grid.
  const safe = isExplicitFilterOn();
  return useInfiniteQuery<{ items: MediaItem[]; hasMore: boolean }>({
    queryKey: ["catalog", kind, safe],
    queryFn: async ({ pageParam }) => {
      try {
        const res = await fetchers[kind](pageParam as number);
        return { ...res, items: filterExplicit(res.items) };
      } catch {
        const all = byKind(kind);
        const page = pageParam as number;
        const pageSize = 20;
        return {
          items: filterExplicit(all.slice((page - 1) * pageSize, page * pageSize)),
          hasMore: page * pageSize < all.length,
        };
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last, allPages) => (last.hasMore ? allPages.length + 1 : undefined),
    staleTime: STALE_TIMES[kind],
    gcTime: 30 * 60_000,
  });
}

export type AnimeCategory = "trending" | "popular" | "top-rated" | "seasonal";

const ANIME_CATEGORY_FETCHERS: Record<
  AnimeCategory,
  (page: number, perPage: number) => Promise<{ items: MediaItem[]; hasMore: boolean }>
> = {
  trending: fetchTrendingAnime,
  popular: fetchPopularAnime,
  "top-rated": fetchTopRatedAnime,
  seasonal: fetchSeasonalAnime,
};

export function useAnimeCategory(category: AnimeCategory) {
  const safe = isExplicitFilterOn();
  return useQuery<MediaItem[]>({
    queryKey: ["anime-category", category, safe],
    queryFn: async () => filterExplicit((await ANIME_CATEGORY_FETCHERS[category](1, 20)).items),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useMovieCategory(category: MovieCategory) {
  return useQuery<MediaItem[]>({
    queryKey: ["movie-category", category],
    queryFn: async () => (await fetchTmdbMovies(category, 1)).items,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useTvCategory(category: TvCategory) {
  return useQuery<MediaItem[]>({
    queryKey: ["tv-category", category],
    queryFn: async () => (await fetchTmdbTv(category, 1)).items,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useSpotlight() {
  const { data: anime } = useCatalog("anime");
  const { data: movies } = useCatalog("movie");
  const { data: tv } = useCatalog("tv");
  const animeItems = anime?.pages[0]?.items ?? [];
  const movieItems = movies?.pages[0]?.items ?? [];
  const tvItems = tv?.pages[0]?.items ?? [];
  const mix = [...animeItems.slice(0, 2), ...movieItems.slice(0, 2), ...tvItems.slice(0, 2)].filter(Boolean);
  return { data: mix.length >= 3 ? mix : SPOTLIGHT, isLoading: false };
}

export { CATALOG } from "@/lib/catalog";
