import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites, useWatchlist, useLibraryActions } from "@/hooks/useFavorites";
import {
  useWatchProgressCount,
  useContinueWatching,
  useRecentlyWatched,
  useRemoveProgress,
  type WatchProgress,
} from "@/hooks/useWatchHistory";
import { useProfile, useSyncProfile } from "@/hooks/useProfile";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  BookmarkCheck,
  Clock,
  Play,
  Trash2,
  Tv,
  Film,
  BookOpen,
  Sparkles,
  User,
  ArrowRight,
  Star,
  Eye,
  ListTodo,
  RefreshCw,
} from "lucide-react";
import type { MediaItem } from "@/lib/catalog";
import { SmartImage } from "@/components/SmartImage";
import { GridSkeleton } from "@/components/Skeletons";

type FilterKind = "all" | "anime" | "movie" | "tv";

const FILTERS: { id: FilterKind; label: string; icon: typeof Tv }[] = [
  { id: "all", label: "All", icon: Star },
  { id: "anime", label: "Anime", icon: Tv },
  { id: "movie", label: "Movies", icon: Film },
  { id: "tv", label: "TV", icon: Play },
];

function itemHref(mediaId: string, kind: string): string {
  if (kind === "tv") {
    const inner = mediaId.replace(/^tv:/, "");
    return `/tv/${inner}`;
  }
  return `/title/${mediaId}`;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Heart;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 text-center hover:scale-[1.02] transition-transform"
    >
      <div className={`size-10 rounded-xl ${color} grid place-items-center mx-auto mb-2`}>
        <Icon className="size-5" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{label}</p>
    </motion.div>
  );
}

function EmptyState({ kind }: { kind: FilterKind }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 glass rounded-3xl"
    >
      <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        {kind === "all" ? (
          <Heart className="size-8 text-slate-500" />
        ) : kind === "anime" ? (
          <Tv className="size-8 text-slate-500" />
        ) : kind === "movie" ? (
          <Film className="size-8 text-slate-500" />
        ) : (
          <Play className="size-8 text-slate-500" />
        )}
      </div>
      <p className="text-slate-400 text-sm mb-1">
        {kind === "all" ? "Your library is empty" : `No ${kind} titles yet`}
      </p>
      <p className="text-xs text-slate-500 mb-6 max-w-xs mx-auto">
        {kind === "all"
          ? "Start exploring and save your favorites and watchlist items here."
          : `Browse ${kind} and heart or bookmark titles to add them here.`}
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link
          to="/anime"
          className="px-4 py-2.5 bg-brand text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Tv className="size-3.5" /> Browse Anime
        </Link>
        <Link
          to="/movies"
          className="px-4 py-2.5 glass text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <Film className="size-3.5" /> Browse Movies
        </Link>
        <Link
          to="/tv"
          className="px-4 py-2.5 glass text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <Play className="size-3.5" /> Browse TV
        </Link>
      </div>
    </motion.div>
  );
}

function ProgressRail({
  title,
  icon: Icon,
  rows,
  onRemove,
}: {
  title: string;
  icon: typeof Clock;
  rows: WatchProgress[];
  onRemove: (id: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3 uppercase tracking-widest">
        <Icon className="size-4 text-brand" />
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group relative w-36 sm:w-40 shrink-0 snap-start"
          >
            <Link to={itemHref(row.media_id, row.kind) as any} className="block">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface border border-white/5 group-hover:border-brand/40 transition-all">
                {row.image ? (
                  <SmartImage
                    src={row.image}
                    alt={row.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-slate-700 text-3xl">
                    {row.kind === "tv" ? "📺" : row.kind === "movie" ? "🎬" : "📖"}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                  <Play className="size-8 text-white fill-current" />
                </div>
              </div>
              <h3 className="text-xs font-semibold text-white line-clamp-1 mt-2 group-hover:text-brand transition-colors">
                {row.title}
              </h3>
              {row.episode_number != null && (
                <p className="text-[11px] text-slate-500 mt-0.5">Episode {row.episode_number}</p>
              )}
            </Link>
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label="Remove from history"
              className="absolute top-1.5 right-1.5 size-7 rounded-lg bg-black/70 backdrop-blur-md text-slate-300 hover:text-white hover:bg-red-500/80 grid place-items-center opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function LibraryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"favorite" | "watchlist">("favorite");
  const [filter, setFilter] = useState<FilterKind>("all");
  useSyncProfile();
  const { data: profile } = useProfile();
  const { data: favs, isLoading: favsLoading } = useFavorites();
  const { data: watchlist, isLoading: watchLoading } = useWatchlist();
  const { handleToggle } = useLibraryActions();
  const { continueWatchingCount, recentlyWatchedCount } = useWatchProgressCount();
  const { data: continueWatching } = useContinueWatching();
  const { data: recentlyWatched } = useRecentlyWatched();
  const removeProgress = useRemoveProgress();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const activeData = tab === "favorite" ? favs : watchlist;
  const isLoading = tab === "favorite" ? favsLoading : watchLoading;

  const filtered = useMemo(() => {
    if (!activeData) return [];
    if (filter === "all") return activeData;
    return activeData.filter((r) => r.kind === filter);
  }, [activeData, filter]);

  if (!user) return null;

  const favCount = favs?.length ?? 0;
  const watchCount = watchlist?.length ?? 0;
  const totalCount = favCount + watchCount;

  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const displayName = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User";

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative -mx-3 sm:-mx-6 lg:-mx-12 mb-8"
        >
          <div className="relative h-40 sm:h-48 overflow-hidden rounded-b-3xl">
            <div className="absolute inset-0 bg-gradient-to-r from-brand/20 via-brand/5 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-primary" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-12 pb-6">
            <div className="flex items-center gap-4">
              <div className="size-14 sm:size-16 rounded-full overflow-hidden border-2 border-white/20 bg-surface flex items-center justify-center shrink-0 shadow-xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <User className="size-6 sm:size-7 text-slate-400" />
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {displayName}'s Library
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  {totalCount} saved {totalCount === 1 ? "title" : "titles"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Heart} label="Favorites" value={favCount} color="bg-red-500/20 text-red-400" />
          <StatCard icon={BookmarkCheck} label="Watchlist" value={watchCount} color="bg-brand/20 text-brand" />
          <StatCard icon={Clock} label="Continue Watching" value={continueWatchingCount} color="bg-amber-500/20 text-amber-400" />
          <StatCard icon={Eye} label="Recently Watched" value={recentlyWatchedCount} color="bg-emerald-500/20 text-emerald-400" />
        </div>

        <ProgressRail
          title="Continue Watching"
          icon={Clock}
          rows={continueWatching ?? []}
          onRemove={(id) => removeProgress.mutate(id)}
        />
        <ProgressRail
          title="Recently Watched"
          icon={Eye}
          rows={(recentlyWatched ?? []).filter((r) => r.completed)}
          onRemove={(id) => removeProgress.mutate(id)}
        />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab("favorite")}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                tab === "favorite"
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : "glass text-slate-300 hover:text-white"
              }`}
            >
              <Heart className={`size-4 ${tab === "favorite" ? "fill-current" : ""}`} />
              Favorites
              {favCount > 0 && (
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{favCount}</span>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab("watchlist")}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                tab === "watchlist"
                  ? "bg-brand text-white shadow-lg shadow-brand/25"
                  : "glass text-slate-300 hover:text-white"
              }`}
            >
              <BookmarkCheck className="size-4" />
              Watchlist
              {watchCount > 0 && (
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{watchCount}</span>
              )}
            </motion.button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === f.id
                      ? "bg-white/15 text-white"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="size-3" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GridSkeleton count={6} />
            </motion.div>
          ) : !filtered.length ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState kind={filter} />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                    <Link to={itemHref(row.media_id, row.kind) as any} className="block">
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-3 bg-surface border border-white/5 group-hover:border-brand/40 group-hover:shadow-xl group-hover:shadow-brand/10 transition-all duration-300">
                        {row.image ? (
                          <SmartImage
                            src={row.image}
                            alt={row.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-700 text-4xl">
                            {row.kind === "tv" ? "📺" : row.kind === "movie" ? "🎬" : "📖"}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {row.badge && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold text-white border border-white/10">
                            {row.badge}
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-brand transition-colors">
                        {row.title}
                      </h3>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">
                        {row.kind} &bull; {row.genre}
                      </p>
                    </Link>
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
                          tab,
                        )
                      }
                      className="absolute top-2 right-2 size-8 rounded-full bg-black/70 backdrop-blur-md grid place-items-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/90"
                      aria-label={`Remove from ${tab}`}
                    >
                      <Trash2 className="size-3.5" />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "My Library — Kyrox" }] }),
  component: LibraryPage,
});
