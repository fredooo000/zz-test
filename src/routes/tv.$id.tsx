import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Star, Loader2, Heart, Plus, Play, SkipForward, RotateCcw } from "lucide-react";
import { StreamEmbed } from "@/components/StreamEmbed";
import { TV_TMDB_IDS } from "@/lib/stream-ids";
import { TV_SERVERS } from "@/lib/stream-providers";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SmartImage } from "@/components/SmartImage";
import { fetchTmdbDetail, fetchTmdbSeasonEpisodes, type TmdbEpisode, type TmdbSeason } from "@/lib/tmdb";
import { useAuth } from "@/hooks/useAuth";
import { useIsFavorite, useIsWatchlist, useLibraryActions } from "@/hooks/useFavorites";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ── ID resolution ─────────────────────────────────────────────────────────────
// BUG FIX: old code did parseInt("tmdb-124364") → NaN and never checked the
// tmdb- regex. Now we check the regex first.
function resolveTvTmdbId(id: string): number | null {
  // 1. tmdb-NNNN (what TMDB browse cards produce) - check first
  const m = id.match(/tmdb-(\d+)/);
  if (m) return parseInt(m[1]);
  // 2. Named catalog entry e.g. "tv-1"
  if (TV_TMDB_IDS[id]) return TV_TMDB_IDS[id];
  // 3. Raw numeric
  const n = parseInt(id);
  if (!isNaN(n) && n > 0) return n;
  return null;
}

export const Route = createFileRoute("/tv/$id")({
  head: ({ params }) => ({
    meta: [{ title: "TV Show — Kyrox" }],
  }),
  component: TvDetailPage,
});

const PAGE_SIZE = 50;

function TvDetailPage() {
  const { id } = Route.useParams();
  const tmdbId = resolveTvTmdbId(id);

  const { user } = useAuth();
  const { handleToggle } = useLibraryActions();

  // Build a stable media_id for library ops from the URL param
  const mediaId = `tv:${id}`;
  const isFav = useIsFavorite(mediaId);
  const inWatch = useIsWatchlist(mediaId);

  const [server, setServer] = useState("vidlink-tv");
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEp, setSelectedEp] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(true);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const detail = useQuery({
    queryKey: ["tv-detail", tmdbId],
    queryFn: async () => {
      if (!tmdbId) throw new Error("No TMDB ID");
      return fetchTmdbDetail(tmdbId, "tv");
    },
    enabled: !!tmdbId,
    staleTime: 10 * 60_000,
  });

  // Season list comes from the lightweight detail call. We no longer fetch every
  // season's episodes up front — that round-trip-per-season was the main cause
  // of slow TV detail loads.
  const seasons = useMemo<TmdbSeason[]>(() => detail.data?.seasons ?? [], [detail.data]);

  // Auto-select the first season once detail loads.
  useEffect(() => {
    if (seasons.length > 0 && selectedSeason === null) {
      setSelectedSeason(seasons[0].season);
    }
  }, [seasons, selectedSeason]);

  // Only the selected season's episodes are fetched — lazy, and cached per season
  // so switching back to a previously viewed season is instant.
  const episodesData = useQuery({
    queryKey: ["tv-episodes", tmdbId, selectedSeason],
    queryFn: async () => {
      if (!tmdbId || selectedSeason == null) throw new Error("No season");
      return fetchTmdbSeasonEpisodes(tmdbId, selectedSeason);
    },
    enabled: !!tmdbId && selectedSeason != null,
    staleTime: 10 * 60_000,
  });

  const filteredEps: TmdbEpisode[] = episodesData.data ?? [];

  // Pagination for large seasons
  const [epRangeIdx, setEpRangeIdx] = useState(0);
  useEffect(() => { setEpRangeIdx(0); }, [selectedSeason]);

  const epRanges = useMemo(() => {
    const n = filteredEps.length;
    const cnt = Math.ceil(n / PAGE_SIZE);
    return Array.from({ length: cnt }, (_, i) => ({
      label: `${i * PAGE_SIZE + 1}–${Math.min((i + 1) * PAGE_SIZE, n)}`,
      startIdx: i * PAGE_SIZE,
      endIdx: Math.min((i + 1) * PAGE_SIZE, n),
    }));
  }, [filteredEps]);

  const visibleEps = useMemo(
    () => filteredEps.slice(epRanges[epRangeIdx]?.startIdx ?? 0, epRanges[epRangeIdx]?.endIdx),
    [filteredEps, epRanges, epRangeIdx],
  );

  // ── Playback ────────────────────────────────────────────────────────────────
  const serverUrl = useMemo(() => {
    if (!tmdbId || !selectedEp) return null;
    const season = selectedSeason ?? 1;
    const srv = TV_SERVERS.find((s) => s.id === server);
    if (!srv) return null;
    return srv.buildUrl(tmdbId, `${season}/${selectedEp}`);
  }, [server, tmdbId, selectedEp, selectedSeason]);

  const serverSandbox = useMemo(
    () => TV_SERVERS.find((s) => s.id === server)?.sandbox,
    [server],
  );

  const currentEpIdx = filteredEps.findIndex((e) => e.number === selectedEp);
  const hasNext = currentEpIdx >= 0 && currentEpIdx < filteredEps.length - 1;
  const hasPrev = currentEpIdx > 0;

  const playNext = useCallback(() => {
    if (!hasNext) return;
    setSelectedEp(filteredEps[currentEpIdx + 1].number);
  }, [hasNext, currentEpIdx, filteredEps]);

  // Auto-next via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.origin.includes("vidsrc") && !e.origin.includes("vidlink") && !e.origin.includes("vidfast") && !e.origin.includes("vixsrc")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "complete" && autoNext) playNext();
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [autoNext, playNext]);

  // ── Library ─────────────────────────────────────────────────────────────────
  const handleSave = (status: "favorite" | "watchlist") => {
    if (!user) { toast.error("Sign in to save titles"); return; }
    const show = detail.data;
    handleToggle(
      {
        id: mediaId,
        title: show?.title ?? "TV Show",
        kind: "tv" as any,
        image: show?.image ?? "",
        genre: show?.genres?.slice(0, 2).join(" • ") ?? "Series",
        synopsis: show?.description ?? "",
        badge: "TV",
      } as any,
      status,
    );
  };

  const show = detail.data;

  if (!tmdbId) {
    return (
      <AppShell>
        <Link to="/tv" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="size-4" /> Back to TV Shows
        </Link>
        <div className="text-center py-32">
          <p className="text-white mb-2 font-semibold">Show not found</p>
          <p className="text-slate-500 text-sm mb-4">ID "{id}" could not be resolved to a TMDB entry.</p>
          <Link to="/tv" className="text-brand hover:underline">Browse TV Shows</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/tv" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm">
        <ArrowLeft className="size-4" /> Back to TV Shows
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {show ? (
        <div className="relative -mx-4 sm:-mx-6 lg:-mx-12 mb-8">
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <SmartImage src={show.cover} alt="" className="w-full h-full object-cover blur-2xl opacity-30 scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary to-transparent" />
          </div>
          <div className="px-4 sm:px-6 lg:px-12 -mt-28 sm:-mt-36 relative grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
            <SmartImage src={show.image} alt={show.title} className="w-32 sm:w-40 md:w-full aspect-[3/4] rounded-2xl object-cover border border-white/10" />
            <div className="md:pt-16">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-0.5 bg-brand text-white text-[10px] font-bold rounded uppercase tracking-widest">TV</span>
                {show.genres.length > 0 && <span className="text-slate-400 text-sm">{show.genres.slice(0, 2).join(" • ")}</span>}
                {show.year && <span className="text-slate-500 text-sm">• {show.year}</span>}
                {show.rating && (
                  <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
                    <Star className="size-3.5 fill-current" /> {show.rating}
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">{show.title}</h1>
              <p className="text-slate-300 max-w-2xl text-sm leading-relaxed mb-4">{show.description}</p>
              {show.tagline && <p className="text-slate-500 text-xs italic mb-4">"{show.tagline}"</p>}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {filteredEps[0] && (
                  <button
                    type="button"
                    onClick={() => setSelectedEp(filteredEps[0].number)}
                    className="px-5 py-2.5 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-[0.97] transition-transform flex items-center gap-2 text-sm"
                  >
                    <Play className="size-4 fill-current" /> Watch S{selectedSeason ?? 1}E1
                  </button>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSave("favorite")}
                  className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg ${isFav ? "bg-red-500 text-white" : "glass text-white hover:bg-white/10"}`}
                >
                  <Heart className={`size-4 ${isFav ? "fill-current" : ""}`} />
                  {isFav ? "Favorited" : "Favorite"}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSave("watchlist")}
                  className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg ${inWatch ? "bg-brand text-white" : "glass text-white hover:bg-white/10"}`}
                >
                  <Plus className="size-4" />
                  {inWatch ? "In Watchlist" : "Watchlist"}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      ) : detail.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 mb-6">
          <Loader2 className="size-4 animate-spin" /> Loading show details...
        </div>
      ) : (
        <p className="text-slate-500 mb-6">Could not load show details.</p>
      )}

      {/* ── Player ─────────────────────────────────────────────────────────── */}
      {serverUrl && selectedEp != null && (
        <section className="mb-8">
          <StreamEmbed src={serverUrl} title={show?.title} sandbox={serverSandbox} />
          {/* Nav bar */}
          <div className="sticky top-2 z-10 mt-3 flex items-center gap-3 flex-wrap glass rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              {hasPrev && (
                <button type="button" onClick={() => setSelectedEp(filteredEps[currentEpIdx - 1].number)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                  <RotateCcw className="size-3" /> Prev
                </button>
              )}
              <span className="text-xs text-slate-400 px-1">S{selectedSeason ?? 1}E{selectedEp}</span>
              {hasNext && (
                <button type="button" onClick={playNext} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                  Next <SkipForward className="size-3" />
                </button>
              )}
            </div>
            <span className="w-px h-4 bg-white/10" />
            <span className="text-xs text-slate-400 uppercase tracking-widest">Server</span>
            <div className="flex gap-1.5 flex-wrap">
              {TV_SERVERS.map((s) => (
                <button key={s.id} type="button" onClick={() => setServer(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${server === s.id ? "bg-brand text-white" : "glass text-slate-400 hover:text-white"}`}>
                  {s.shortLabel}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <button type="button" onClick={() => setAutoNext(!autoNext)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${autoNext ? "bg-brand/20 text-brand border border-brand/30" : "glass text-slate-400"}`}>
                Auto-next {autoNext ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Episodes section ────────────────────────────────────────────────── */}
      <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
          <h2 className="font-display text-2xl font-bold text-white">Episodes</h2>
          {filteredEps.length > 0 && (
            <span className="text-xs font-semibold text-slate-400 glass px-2 py-1 rounded-md">
              {filteredEps.length}
            </span>
          )}
        </div>

        {/* Season tabs */}
        {seasons.length > 1 && selectedSeason != null && (
          <div className="flex gap-2 mb-5 flex-wrap overflow-x-auto no-scrollbar pb-1">
            {seasons.map((s) => (
              <button
                key={s.season}
                type="button"
                onClick={() => {
                  setSelectedSeason(s.season);
                  setSelectedEp(null);
                }}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border whitespace-nowrap active:scale-95 ${
                  selectedSeason === s.season
                    ? "bg-brand text-white border-brand"
                    : "glass text-slate-300 border-white/10 hover:border-white/30 hover:text-white"
                }`}
              >
                {s.name}
                <span className={`ml-1.5 text-xs ${selectedSeason === s.season ? "text-white/70" : "text-slate-500"}`}>
                  ({s.episodeCount})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Pagination for large seasons */}
        {epRanges.length > 1 && (
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {epRanges.map((r, i) => (
              <button key={r.label} type="button" onClick={() => setEpRangeIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-90 ${i === epRangeIdx ? "bg-brand text-white" : "glass text-slate-400 hover:text-white"}`}>
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Episode grid */}
        {episodesData.isLoading ? (
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : visibleEps.length > 0 ? (
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 sm:gap-2.5">
            {visibleEps.map((ep) => (
              <button
                key={`${ep.season}-${ep.number}`}
                type="button"
                onClick={() => setSelectedEp(ep.number)}
                title={ep.title}
                className={`aspect-square glass rounded-lg sm:rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 group ${
                  selectedEp === ep.number
                    ? "border-brand text-brand brand-glow"
                    : "text-slate-300 hover:text-white hover:border-white/20"
                }`}
              >
                <span className={`text-[9px] uppercase tracking-widest mb-0.5 ${selectedEp === ep.number ? "text-brand" : "text-slate-500 group-hover:text-brand"}`}>
                  EP
                </span>
                <span className="text-xs sm:text-sm md:text-base font-bold leading-tight">{ep.number}</span>
              </button>
            ))}
          </div>
        ) : !episodesData.isLoading && (
          <p className="text-slate-500 text-center py-16">No episodes available.</p>
        )}
      </section>
    </AppShell>
  );
}
