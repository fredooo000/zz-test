import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Heart, Tv, BookOpen, Clapperboard, Film, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites, useLibraryActions } from "@/hooks/useFavorites";
import type { MediaItem } from "@/lib/catalog";
import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  { id: "all", label: "All", icon: Heart },
  { id: "anime", label: "Anime", icon: Tv },
  { id: "manga", label: "Manga", icon: BookOpen },
  { id: "manhwa", label: "Manhwa", icon: BookOpen },
  { id: "movie", label: "Movies", icon: Clapperboard },
  { id: "tv", label: "TV Shows", icon: Film },
] as const;

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorites — Kyrox" }] }),
  component: FavoritesPage,
});

// Build the correct detail URL for any kind
function itemHref(mediaId: string, kind: string): string {
  if (kind === "tv") {
    // mediaId is "tv:tmdb-XXXX" or "tv:tv-1" etc — extract the inner id
    const inner = mediaId.replace(/^tv:/, "");
    return `/tv/${inner}`;
  }
  return `/title/${mediaId}`;
}

function FavoritesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("all");

  // Redirect to auth if not signed in
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Pull favorites from Supabase
  const { data, isLoading } = useFavorites();
  const { handleToggle } = useLibraryActions();

  if (!user) return null;

  const filtered =
    activeTab === "all" ? (data ?? []) : (data ?? []).filter((i) => i.kind === activeTab);

  return (
    <AppShell>
      <div className="min-h-screen">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="size-6 text-red-400" />
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Favorites</h1>
        </div>
        <p className="text-slate-400 mb-8 text-sm sm:text-base">Your personally curated collection.</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.id === "all"
                ? (data?.length ?? 0)
                : (data?.filter((i) => i.kind === tab.id).length ?? 0);
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-brand text-white"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20" : "bg-white/10"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="size-5 animate-spin" /> Loading favorites...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500 gap-4">
            <Heart className="size-12" />
            <p className="text-sm font-medium">No favorites yet</p>
            <p className="text-xs text-slate-600 text-center max-w-sm">
              Heart items from their detail pages to save them here.
            </p>
            <div className="flex gap-3 mt-2 flex-wrap justify-center">
              <Link to="/anime" className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-white">Browse Anime</Link>
              <Link to="/manga" className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-white">Browse Manga</Link>
              <Link to="/movies" className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-white">Browse Movies</Link>
              <Link to="/tv" className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-white">Browse TV</Link>
            </div>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
          >
            <AnimatePresence>
              {filtered.map((row) => (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="group relative"
                >
                <Link to={itemHref(row.media_id, row.kind)} className="block">
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-3 bg-surface border border-white/5 group-hover:border-brand/40 group-hover:brand-glow transition-all">
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Heart className="size-8" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white line-clamp-1">{row.title}</h3>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{row.kind} • {row.genre}</p>
                </Link>
                {/* Remove button */}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  type="button"
                  onClick={() =>
                    handleToggle(
                      {
                        id: row.media_id,
                        title: row.title ?? "",
                        kind: row.kind as MediaItem["kind"],
                        image: row.image ?? "",
                        genre: row.genre ?? "",
                        synopsis: "",
                      } as MediaItem,
                      "favorite",
                    )
                  }
                  className="absolute top-2 right-2 size-8 rounded-full bg-black/70 backdrop-blur-md grid place-items-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/90"
                  aria-label="Remove from favorites"
                >
                  <Trash2 className="size-3.5" />
                </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          )}
      </div>
    </AppShell>
  );
}
