import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MediaGrid } from "@/components/MediaCard";
import { GridSkeleton } from "@/components/Skeletons";
import { useCatalog, useMovieCategory } from "@/hooks/useCatalog";
import { motion } from "framer-motion";
import { Loader2, Search, TrendingUp, Star, Clock, Flame } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchTmdb } from "@/lib/tmdb";
import { filterExplicit } from "@/lib/settings";
import type { MovieCategory } from "@/lib/tmdb";
import { SmartImage } from "@/components/SmartImage";

const categories: { id: MovieCategory; label: string; icon: typeof TrendingUp }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "now_playing", label: "Now Playing", icon: Clock },
  { id: "top_rated", label: "Top Rated", icon: Star },
  { id: "popular", label: "Popular", icon: TrendingUp },
];

export const Route = createFileRoute("/movies")({
  head: () => ({
    meta: [
      { title: "Movies — Kyrox" },
      { name: "description", content: "Cinematic film catalog." },
    ],
  }),
  component: MoviesPage,
});

function MoviesPage() {
  const [cat, setCat] = useState<MovieCategory>("trending");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: catData, isLoading: catLoading } = useMovieCategory(cat);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCatalog("movie");
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const searchResults = useQuery({
    queryKey: ["search-movies", debouncedQuery],
    queryFn: async () => filterExplicit(await searchTmdb(debouncedQuery, "movie", 20)),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 350);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const showSearchResults = debouncedQuery.length >= 2;

  const heroItem = !showSearchResults && !catLoading && catData && catData.length > 0
    ? catData[Math.floor(Math.random() * Math.min(3, catData.length))]
    : null;

  return (
    <AppShell>
      {/* Hero section */}
      {heroItem && (
        <div className="relative -mx-3 sm:-mx-6 lg:-mx-12 mb-8 rounded-b-3xl overflow-hidden">
          <div className="relative h-48 sm:h-64 lg:h-80">
            <SmartImage
              src={heroItem.image}
              alt=""
              className="w-full h-full object-cover blur-xl opacity-20 scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-brand/80 text-white text-[10px] font-bold rounded uppercase tracking-widest">
                Featured
              </span>
              {heroItem.rating && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                  <Star className="size-3 fill-current" /> {heroItem.rating}
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white mb-2">
              {heroItem.title}
            </h2>
            <p className="text-slate-300 text-sm max-w-xl line-clamp-2 mb-3">
              {heroItem.synopsis}
            </p>
            <Link
              to="/title/$id"
              params={{ id: heroItem.id }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform text-sm"
            >
              View Details
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Movies</h1>
          <p className="text-slate-400 text-sm mt-1">Cinema across every genre, era, and dimension.</p>
        </div>
        <div className="relative w-full sm:w-72 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-brand transition-colors" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            type="text"
            placeholder="Search movies..."
            className="w-full bg-surface/50 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600 text-white"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!showSearchResults && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar"
        >
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCat(c.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  cat === c.id
                    ? "bg-brand text-white shadow-lg shadow-brand/25"
                    : "glass text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="size-4" />
                {c.label}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Search results info */}
      {showSearchResults && (
        <p className="text-slate-400 mb-4 text-sm">
          {searchResults.isLoading
            ? "Searching..."
            : `${searchResults.data?.length ?? 0} results for "${debouncedQuery}"`}
        </p>
      )}

      {/* Content */}
      {showSearchResults ? (
        searchResults.isLoading ? (
          <GridSkeleton />
        ) : (
          <MediaGrid items={searchResults.data ?? []} />
        )
      ) : catLoading ? (
        <GridSkeleton />
      ) : catData && catData.length > 0 ? (
        <MediaGrid items={catData} />
      ) : (
        <>
          {isLoading ? (
            <GridSkeleton />
          ) : (
            <>
              <MediaGrid items={items} />
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="glass px-6 py-3 rounded-xl text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isFetchingNextPage ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
