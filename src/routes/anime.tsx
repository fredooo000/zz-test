import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MediaGrid } from "@/components/MediaCard";
import { CategoryRail } from "@/components/CategoryRail";
import { GridSkeleton } from "@/components/Skeletons";
import { useCatalog } from "@/hooks/useCatalog";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/anime")({
  head: () => ({
    meta: [{ title: "Anime — Kyrox" }, { name: "description", content: "Browse trending anime." }],
  }),
  component: AnimePage,
});

function AnimePage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCatalog("anime");
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-2">Anime</h1>
        <p className="text-slate-400 mb-8 text-sm sm:text-base">
          Stream the latest seasonal hits and timeless classics.
        </p>
      </motion.div>

      <CategoryRail title="New This Season" category="seasonal" viewAll="/anime" />
      <CategoryRail title="All-Time Popular" category="popular" viewAll="/anime" />
      <CategoryRail title="Top Rated" category="top-rated" viewAll="/anime" />

      <h2 className="font-display text-2xl font-bold text-white mb-5">Trending Now</h2>
      {isLoading && !items.length ? <GridSkeleton /> : <MediaGrid items={items} />}
      {hasNextPage && (
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
