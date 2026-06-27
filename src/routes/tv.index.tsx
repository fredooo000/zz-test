import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MediaGrid } from "@/components/MediaCard";
import { GridSkeleton } from "@/components/Skeletons";
import { useCatalog } from "@/hooks/useCatalog";
import { motion } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchTmdb } from "@/lib/tmdb";
import { filterExplicit } from "@/lib/settings";

export const Route = createFileRoute("/tv/")({
  head: () => ({
    meta: [
      { title: "TV Shows — Kyrox" },
      { name: "description", content: "Binge-watch TV series." },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCatalog("tv");
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const navigate = useNavigate();

  const searchResults = useQuery({
    queryKey: ["search-tv", searchQuery],
    queryFn: async () => filterExplicit(await searchTmdb(searchQuery, "tv", 20)),
    enabled: searchQuery.length >= 2,
    staleTime: 30000,
  });

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        navigate({ to: "/search", search: { q: value.trim(), kind: "tv" } });
      }
    }, 400);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const showSearchResults = searchQuery.length >= 2;
  const displayItems = showSearchResults ? (searchResults.data ?? []) : items;
  const isLoadingDisplay = showSearchResults ? searchResults.isLoading : (isLoading && !items.length);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-2">TV Shows</h1>
        <p className="text-slate-400 mb-4">
          Binge-watch your favorite TV series and discover new ones.
        </p>
      </motion.div>

      <div className="relative w-full max-w-xl mb-6 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-brand transition-colors" />
        <input
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          type="text"
          placeholder="Search TV shows..."
          className="w-full bg-surface/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600 text-white"
        />
      </div>

      {showSearchResults && (
        <p className="text-slate-400 mb-4 text-sm">
          {searchResults.isLoading ? "Searching..." : `${searchResults.data?.length ?? 0} results for "${searchQuery}"`}
        </p>
      )}

      {isLoadingDisplay ? <GridSkeleton /> : <MediaGrid items={displayItems} />}
      {!showSearchResults && hasNextPage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mt-8"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="glass px-6 py-3 rounded-xl text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : null}
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </motion.button>
        </motion.div>
      )}
    </AppShell>
  );
}
