import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { MediaGrid } from "@/components/MediaCard";
import { GridSkeleton } from "@/components/Skeletons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SEARCH_FN, type SearchKind } from "@/lib/search";
import { filterExplicit, isExplicitFilterOn } from "@/lib/settings";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  kind: z.enum(["all", "anime", "manga", "manhwa", "movie", "tv"]).optional().default("all"),
});

const KINDS: { value: SearchKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
];

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Search \u2014 Kyrox" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q, kind } = Route.useSearch();
  const query = (q ?? "").trim();
  const activeKind = (kind ?? "all") as SearchKind;
  const [input, setInput] = useState(query);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const safe = isExplicitFilterOn();
  const results = useQuery({
    queryKey: ["search", activeKind, query, safe],
    queryFn: async () => filterExplicit(await SEARCH_FN[activeKind](query)),
    enabled: query.length >= 2,
    staleTime: 30000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      navigate({ to: "/search", search: { q: input.trim(), kind: activeKind } });
    }
  };

  const setKind = (k: SearchKind) => {
    navigate({ to: "/search", search: { q: query || undefined, kind: k } });
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        navigate({ to: "/search", search: { q: value.trim(), kind: activeKind } });
      }
    }, 300);
  };

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <form onSubmit={handleSubmit} className="relative w-full max-w-xl group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-brand transition-colors" />
          <input
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            type="text"
            placeholder="Search anime, manga, movies, TV..."
            className="w-full bg-surface/50 border border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600 text-white"
          />
        </form>
      </motion.div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setKind(k.value)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap active:scale-95 ${
              activeKind === k.value
                ? "bg-brand text-white"
                : "glass text-slate-400 hover:text-white"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {query.length < 2 && (
        <p className="text-slate-500 text-sm">
          Type at least 2 characters to search across anime, manga, manhwa, movies, and TV shows.
        </p>
      )}

      {query.length >= 2 && (
        <>
          <p className="text-slate-400 mb-6 text-sm">
            {results.isLoading
              ? "Searching..."
              : `${results.data?.length ?? 0} result${results.data?.length !== 1 ? "s" : ""} for "${query}"`}
          </p>
          {results.isLoading ? (
            <GridSkeleton />
          ) : results.data && results.data.length > 0 ? (
            <MediaGrid items={results.data} />
          ) : (
            <div className="text-center py-16">
              <p className="text-slate-500">
                No results found for "{query}" in {KINDS.find((k) => k.value === activeKind)?.label}
                .
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Try a different spelling, change the filter, or browse categories above.
              </p>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
