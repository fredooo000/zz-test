import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MediaGrid } from "@/components/MediaCard";
import { GridSkeleton } from "@/components/Skeletons";
import { useCatalog } from "@/hooks/useCatalog";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/manhwa")({
  head: () => ({
    meta: [{ title: "Manhwa — Kyrox" }, { name: "description", content: "Read manhwa on Kyrox." }],
  }),
  // No SSR loader — same reasoning as manga.tsx. SSR loader was triggering
  // live mangafire.to scrapes from the Worker on every request → timeout flood.
  component: ManhwaPage,
});

function ManhwaPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCatalog("manhwa");
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-2">Manhwa</h1>
        <p className="text-slate-400 mb-8">Korean webtoons in full color.</p>
      </motion.div>
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
