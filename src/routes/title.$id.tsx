import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { findById, type MediaItem } from "@/lib/catalog";
import { MediaGrid } from "@/components/MediaCard";
import {
  Play,
  Plus,
  Heart,
  Star,
  ArrowLeft,
  Loader2,
  Maximize,
  Minimize,
  SkipForward,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cleanSynopsis,
  fetchAnimeInfo,
  fetchAsuraInfo,
  fetchChapterPagesWithFallback,
  fetchMangaInfo,
  fetchTrendingAnime,
  resolveAnimeTitle,
  resolveMangaTitle,
  resolveRealMovieOrTV,
} from "@/lib/api";
import { fetchTmdbDetail } from "@/lib/tmdb";
import { useAuth } from "@/hooks/useAuth";
import { useIsFavorite, useIsWatchlist, useLibraryActions } from "@/hooks/useFavorites";
import { useUpdateProgress } from "@/hooks/useWatchHistory";
import { toast } from "sonner";
import { ServerSelector } from "@/components/ServerSelector";
import { StreamEmbed } from "@/components/StreamEmbed";
import { ANIME_SERVERS, MOVIE_SERVERS, fetchAnilistMeta } from "@/lib/stream-providers";
import { TMDB_IDS } from "@/lib/stream-ids";

export const Route = createFileRoute("/title/$id")({
  loader: ({ params }) => {
    const local = findById(params.id);
    if (local) return { item: local };
    const [kind, rawId] = params.id.split(":");
    if (!kind || !rawId) throw notFound();
    const stub: MediaItem = {
      id: params.id,
      title: "Loading\u2026",
      kind: kind as MediaItem["kind"],
      genre: "",
      synopsis: "",
      image: "",
    };
    return { item: stub, liveId: rawId };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.item.title ?? "Title"} \u2014 Kyrox` },
      { name: "description", content: loaderData?.item.synopsis ?? "" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <div className="text-center py-32">
        <h1 className="font-display text-3xl text-white mb-2">Not found</h1>
        <Link to="/" className="text-brand hover:underline">
          Back home
        </Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="text-center py-32">
        <p className="text-white mb-2 font-semibold">Couldn't load this title</p>
        <p className="text-slate-500 text-xs mb-4 max-w-md mx-auto">{(error as Error)?.message}</p>
        <Link to="/" className="text-brand hover:underline">
          Back home
        </Link>
      </div>
    </AppShell>
  ),
  component: TitlePage,
});

const PAGE_SIZE = 50;

function stripSeason(title: string): { cleanTitle: string; seasonLabel: string | null } {
  const patterns = [
    /[-–—]\s*Season\s+(\d+)/i,
    /[-–—]\s*S(?:eason)?\.?\s*(\d+)/i,
    /(\d+)(?:st|nd|rd|th)\s+Season/i,
    /Season\s+(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (!isNaN(num) && num > 0) {
        const clean = title
          .replace(pattern, "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/[-–—]\s*$/, "")
          .trim();
        if (clean.length > 0) {
          return { cleanTitle: clean, seasonLabel: `Season ${num}` };
        }
      }
    }
  }
  // Also handle trailing "Part X" or "2nd Season" format
  const partMatch = title.match(/[-–—]\s*Part\s+(\d+)/i);
  if (partMatch) {
    const num = parseInt(partMatch[1]);
    if (!isNaN(num) && num > 0) {
      const clean = title
        .replace(partMatch[0], "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[-–—]\s*$/, "")
        .trim();
      if (clean.length > 0) {
        return { cleanTitle: clean, seasonLabel: `Part ${num}` };
      }
    }
  }
  return { cleanTitle: title, seasonLabel: null };
}

function TitlePage() {
  const { item, liveId } = Route.useLoaderData() as { item: MediaItem; liveId?: string };
  const isReadable = item.kind === "manga" || item.kind === "manhwa";
  const isWatchable = item.kind === "anime" || item.kind === "movie";
  const { user } = useAuth();
  const { handleToggle } = useLibraryActions();
  const isFav = useIsFavorite(item.id);
  const inWatch = useIsWatchlist(item.id);
  const updateProgress = useUpdateProgress();

  type AnimeInfo = Awaited<ReturnType<typeof fetchAnimeInfo>>;
  type MangaInfo = Awaited<ReturnType<typeof fetchMangaInfo>>;
  type MovieDetail = Awaited<ReturnType<typeof fetchTmdbDetail>>;
  const info = useQuery<AnimeInfo | MangaInfo | MovieDetail>({
    queryKey: ["title-info", item.id],
    queryFn: async () => {
      // Movie kind → TMDB-based (direct TMDB API, ~1s vs Consumet ~6s)
      if (item.kind === "movie") {
        const rawId = liveId || item.id;
        let tmdbId: number | undefined;
        const tmdbMatch = rawId.match(/^tmdb-(\d+)$/);
        if (tmdbMatch) {
          tmdbId = parseInt(tmdbMatch[1]);
        } else if (TMDB_IDS[rawId]) {
          tmdbId = TMDB_IDS[rawId];
        } else {
          const resolved = await resolveRealMovieOrTV(item.title, "movie");
          if (resolved) tmdbId = resolved.id;
        }
        if (!tmdbId) throw new Error("No movie metadata found.");
        const info = await fetchTmdbDetail(tmdbId, "movie");
        if (!info) throw new Error("Could not load movie info.");
        return info;
      }
      if (liveId) {
        if (isWatchable) return fetchAnimeInfo(liveId);
        // Manhwa is read from AsuraScans; manga from the mangafire/MangaDex chain.
        return item.kind === "manhwa" ? fetchAsuraInfo(liveId) : fetchMangaInfo(liveId);
      }
      if (isWatchable) {
        const resolved = await resolveAnimeTitle(item.title, item.kind as "anime" | "movie");
        if (!resolved?.id) throw new Error("No stream metadata found for this title.");
        return fetchAnimeInfo(resolved.id);
      }
      if (item.kind === "manhwa") {
        return fetchAsuraInfo(item.title);
      }
      const resolved = await resolveMangaTitle(item.title, item.kind as "manga" | "manhwa");
      if (!resolved?.id) throw new Error("No readable manga source found for this title.");
      return fetchMangaInfo(resolved.id);
    },
    retry: 1,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  type Ep = { id: string; number: number; title?: string; season?: number };
  type Chapter = { id: string; attributes: { chapter?: string; title?: string } };

  const episodes: Ep[] = (
    info.data && "episodes" in info.data ? (info.data.episodes ?? []) : []
  ) as Ep[];
  const chapters: Chapter[] = (
    info.data && "chapters" in info.data ? info.data.chapters : []
  ) as Chapter[];

  const isAnime = item.kind === "anime" || item.kind === "movie";
  const sourceId = info.data && "id" in info.data ? parseInt(String(info.data.id)) : undefined;

  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  const [selectedEpNum, setSelectedEpNum] = useState<number>(1);

  // For anime: fetch AniList meta (MAL ID, TMDB ID from external links)
  const anilistMeta = useQuery({
    queryKey: ["anilist-meta", sourceId],
    queryFn: () =>
      item.kind === "anime" && sourceId ? fetchAnilistMeta(sourceId) : Promise.resolve({}),
    enabled: item.kind === "anime" && !!sourceId,
    staleTime: 60000,
  });

  const [server, setServer] = useState(item.kind === "movie" ? "vidlink" : "megaplay");

  const isMovieKind = item.kind === "movie";
  const activeServers = isMovieKind ? MOVIE_SERVERS : ANIME_SERVERS;

  const availableServers = useMemo(() => {
    return activeServers.map((s) => ({
      id: s.id,
      name: s.name,
      shortLabel: s.shortLabel,
      color: s.color,
      disabled:
        s.requires?.includes("tmdbId") && !(anilistMeta.data as { tmdbId?: number })?.tmdbId,
    }));
  }, [activeServers, anilistMeta.data]);

  const serverUrl = useMemo(() => {
    if (!selectedEpNum || !sourceId) return null;
    // For movies, sourceId = TMDB ID; for anime, sourceId = AniList ID
    const srv = activeServers.find((s) => s.id === server);
    if (!srv) return null;
    return srv.buildUrl(sourceId, String(selectedEpNum), anilistMeta.data);
  }, [server, selectedEpNum, sourceId, anilistMeta.data, activeServers]);

  const serverSandbox = useMemo(
    () => activeServers.find((s) => s.id === server)?.sandbox,
    [server, activeServers],
  );

  // Auto-next
  const [autoNext, setAutoNext] = useState(true);
  const [epCompleted, setEpCompleted] = useState(false);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (
        !event.origin.includes("megaplay.buzz") &&
        !event.origin.includes("dropfile.cc") &&
        !event.origin.includes("vidsrc") &&
        !event.origin.includes("vidfast") &&
        !event.origin.includes("vixsrc")
      )
        return;
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      // MegaPlay sends events on "megacloud" channel with { event: "complete" }
      // Other sources send { event: "complete" } directly.
      if (
        data?.event === "complete" ||
        (data?.channel === "megacloud" && (data as any)?.event === "complete")
      ) {
        setEpCompleted(true);
        if (autoNext) playNextEpisode();
      }
    },
    [autoNext, episodes, selectedEp],
  );

  const playNextEpisode = useCallback(() => {
    if (!selectedEp || !episodes.length) return;
    const idx = episodes.findIndex((e) => e.id === selectedEp);
    if (idx >= 0 && idx < episodes.length - 1) {
      const next = episodes[idx + 1];
      setSelectedEp(next.id);
      setSelectedEpNum(next.number);
      setEpCompleted(false);
    }
  }, [selectedEp, episodes]);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Reset completion state when episode changes
  useEffect(() => {
    setEpCompleted(false);
  }, [selectedEp]);

  // ---

  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const pages = useQuery({
    queryKey: ["chapter-pages", selectedChapter],
    enabled: !!selectedChapter,
    queryFn: () => fetchChapterPagesWithFallback(selectedChapter!),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
  });

  const [chapterRangeIdx, setChapterRangeIdx] = useState(0);

  const chapterRanges = useMemo(() => {
    const n = chapters.length;
    const cnt = Math.ceil(n / PAGE_SIZE);
    return Array.from({ length: cnt }, (_, i) => {
      const start = i * PAGE_SIZE + 1;
      const end = Math.min((i + 1) * PAGE_SIZE, n);
      return { label: `${start}\u2013${end}`, startIdx: i * PAGE_SIZE, endIdx: end };
    });
  }, [chapters]);

  const visibleChapters = useMemo(
    () =>
      chapters.slice(
        chapterRanges[chapterRangeIdx]?.startIdx ?? 0,
        chapterRanges[chapterRangeIdx]?.endIdx,
      ),
    [chapters, chapterRanges, chapterRangeIdx],
  );

  const [epRangeIdx, setEpRangeIdx] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const seasons = useMemo(() => {
    const s = [
      ...new Set(episodes.map((e) => e.season).filter((s): s is number => s != null)),
    ].sort();
    return s.length > 1 ? s : [];
  }, [episodes]);

  const seasonFiltered = useMemo(() => {
    if (!seasons.length || selectedSeason === null) return episodes;
    return episodes.filter((e) => e.season === selectedSeason);
  }, [episodes, seasons, selectedSeason]);

  const epRanges = useMemo(() => {
    const n = seasonFiltered.length;
    const cnt = Math.ceil(n / PAGE_SIZE);
    return Array.from({ length: cnt }, (_, i) => {
      const start = i * PAGE_SIZE + 1;
      const end = Math.min((i + 1) * PAGE_SIZE, n);
      return { label: `${start}\u2013${end}`, startIdx: i * PAGE_SIZE, endIdx: end };
    });
  }, [seasonFiltered]);

  const visibleEpisodes = useMemo(
    () => seasonFiltered.slice(epRanges[epRangeIdx]?.startIdx ?? 0, epRanges[epRangeIdx]?.endIdx),
    [seasonFiltered, epRanges, epRangeIdx],
  );

  const related = useQuery<MediaItem[]>({
    queryKey: ["related", item.kind],
    queryFn: async () => {
      if (item.kind === "movie" || item.kind === "tv") {
        const { byKind } = await import("@/lib/catalog");
        return byKind(item.kind)
          .slice(0, 6)
          .map((m) => ({ ...m, id: m.id }));
      }
      if (item.kind === "anime") return (await fetchTrendingAnime()).items.slice(0, 6);
      return [];
    },
    staleTime: 60000,
  });

  const infoData = info.data as Record<string, unknown> | undefined;
  const rawTitle = infoData?.title;
  const titleStrRaw =
    typeof rawTitle === "string"
      ? rawTitle
      : (rawTitle && typeof rawTitle === "object"
          ? (rawTitle as Record<string, string>)?.english ||
            (rawTitle as Record<string, string>)?.romaji
          : undefined) || item.title;
  const { cleanTitle: titleStr, seasonLabel } = stripSeason(titleStrRaw);
  
  const displayTitle = titleStr || item.title;
  const image = (infoData?.image as string) || item.image;
  const synopsis = cleanSynopsis((infoData?.description as string) || item.synopsis || "\u2014");

  useEffect(() => {
    document.title = `${titleStr} — Kyrox`;
  }, [titleStr]);

  // ─── Watch history ──────────────────────────────────────────────────────────
  // Streams play inside a sandboxed third-party <iframe>, so we can't read exact
  // playback time. Instead we record an entry when the user starts an episode
  // (so it shows under "Continue Watching") and flip it to completed when the
  // embed posts a "complete" message (so it moves to "Recently Watched").
  useEffect(() => {
    if (!user || !isWatchable || !selectedEp || !serverUrl) return;
    updateProgress.mutate({
      media_id: item.id,
      kind: item.kind,
      title: titleStr || item.title,
      image: image || null,
      // selectedEp is "movie" for movies and the episode id otherwise. Always
      // send a non-null value so the (user_id, media_id, episode_id) upsert
      // matches an existing row instead of inserting duplicates (Postgres
      // treats NULLs as distinct in unique constraints).
      episode_id: selectedEp,
      episode_number: isMovieKind ? undefined : selectedEpNum,
      season_number: selectedSeason ?? undefined,
      // Nominal "in progress" marker — iframe playback time isn't observable.
      progress_seconds: 1,
      duration_seconds: 100,
      completed: false,
    });
    // Only when a new episode actually starts playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedEp, serverUrl]);

  useEffect(() => {
    if (!user || !isWatchable || !selectedEp || !epCompleted) return;
    updateProgress.mutate({
      media_id: item.id,
      kind: item.kind,
      title: titleStr || item.title,
      image: image || null,
      episode_id: selectedEp,
      episode_number: isMovieKind ? undefined : selectedEpNum,
      season_number: selectedSeason ?? undefined,
      progress_seconds: 100,
      duration_seconds: 100,
      completed: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, epCompleted]);

  const readerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await readerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handlePlayEp = (ep: Ep) => {
    setSelectedEp(ep.id);
    setSelectedEpNum(ep.number);
  };

  const handleSave = (status: "favorite" | "watchlist") => {
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    handleToggle({ ...item, title: titleStr, image } as MediaItem, status);
  };

  const currentEpIdx = episodes.findIndex((e) => e.id === selectedEp);
  const hasNextEp = currentEpIdx >= 0 && currentEpIdx < episodes.length - 1;
  const hasPrevEp = currentEpIdx > 0;

  return (
    <AppShell>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm active:scale-95 transition-transform"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="relative -mx-4 sm:-mx-6 lg:-mx-12 mb-10">
        <div className="relative h-56 sm:h-72 lg:h-96 overflow-hidden">
          <SmartImage
            src={image}
            alt=""
            className="w-full h-full object-cover blur-2xl opacity-30 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary to-transparent" />
        </div>
        <div className="px-4 sm:px-6 lg:px-12 -mt-32 sm:-mt-40 relative grid grid-cols-1 md:grid-cols-[180px_1fr] lg:grid-cols-[220px_1fr] gap-6 sm:gap-8">
          <SmartImage
            src={image}
            alt={titleStr}
            className="w-36 sm:w-48 md:w-full aspect-[3/4] rounded-2xl object-cover border border-white/10 brand-glow"
          />
          <div className="md:pt-32">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
              <span className="px-2 py-0.5 bg-brand text-white text-[10px] font-bold rounded uppercase tracking-widest">
                {item.kind}
              </span>
              {item.genre && <span className="text-slate-400 text-sm">{item.genre}</span>}
              {item.year && <span className="text-slate-500 text-sm">\u2022 {item.year}</span>}
              {item.rating && (
                <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
                  <Star className="size-3.5 fill-current" /> {item.rating}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
                {displayTitle}
              </h1>
              {seasonLabel && (
                <span className="px-2.5 py-1 bg-brand/20 text-brand text-xs font-bold rounded-md border border-brand/30 whitespace-nowrap">
                  {seasonLabel}
                </span>
              )}
            </div>
            <p className="text-slate-300 max-w-2xl leading-relaxed mb-6 text-sm sm:text-base">
              {synopsis}
            </p>
            <div className="flex flex-wrap gap-3">
              {isMovieKind && sourceId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEp("movie");
                    setSelectedEpNum(1);
                  }}
                  className="px-5 sm:px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-[0.97] transition-transform flex items-center gap-2 text-sm sm:text-base"
                >
                  <Play className="size-4 fill-current" /> Watch Now
                </button>
              )}
              {isWatchable && !isMovieKind && episodes[0] && (
                <button
                  type="button"
                  onClick={() => handlePlayEp(episodes[0])}
                  className="px-5 sm:px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-[0.97] transition-transform flex items-center gap-2 text-sm sm:text-base"
                >
                  <Play className="size-4 fill-current" /> Watch Episode 1
                </button>
              )}
              {isReadable && chapters[0] && (
                <button
                  type="button"
                  onClick={() => setSelectedChapter(chapters[0].id)}
                  className="px-5 sm:px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-[0.97] transition-transform flex items-center gap-2 text-sm sm:text-base"
                >
                  Read Chapter {chapters[0].attributes.chapter ?? 1}
                </button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSave("favorite")}
                className={`px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-sm shadow-lg ${
                  isFav ? "bg-red-500 text-white" : "glass text-white hover:bg-white/10"
                }`}
              >
                <Heart className={`size-4 ${isFav ? "fill-current" : ""}`} />
                {isFav ? "Favorited" : "Favorite"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSave("watchlist")}
                className={`px-4 py-3 rounded-xl flex items-center gap-2 transition-all text-sm shadow-lg ${
                  inWatch ? "bg-brand text-white" : "glass text-white hover:bg-white/10"
                }`}
              >
                <Plus className="size-4" />
                {inWatch ? "In Watchlist" : "Watchlist"}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Player / Server Embed */}
      {isWatchable && selectedEp && (
        <section className="mb-10">
          {serverUrl ? (
            <>
              <StreamEmbed src={serverUrl} title={titleStr} sandbox={serverSandbox} />
              {/* Episode nav bar */}
              <div className="sticky top-2 z-10 mt-3 flex items-center gap-3 flex-wrap glass rounded-xl px-3 py-2">
                {!isMovieKind && (
                  <>
                    <div className="flex items-center gap-1.5">
                      {hasPrevEp && (
                        <button
                          type="button"
                          onClick={() => handlePlayEp(episodes[currentEpIdx - 1])}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <RotateCcw className="size-3" /> Prev
                        </button>
                      )}
                      <span className="text-xs text-slate-400 px-1">Ep {selectedEpNum}</span>
                      {hasNextEp && (
                        <button
                          type="button"
                          onClick={() => handlePlayEp(episodes[currentEpIdx + 1])}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Next <SkipForward className="size-3" />
                        </button>
                      )}
                    </div>

                    <span className="w-px h-4 bg-white/10" />
                  </>
                )}

                <span className="text-xs text-slate-400 uppercase tracking-widest">Server</span>
                <ServerSelector servers={availableServers} active={server} onSelect={setServer} />

                {!isMovieKind && (
                  <div className="ml-auto flex items-center gap-2">
                    {epCompleted && !autoNext && hasNextEp && (
                      <button
                        type="button"
                        onClick={playNextEpisode}
                        className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-semibold flex items-center gap-1 animate-pulse"
                      >
                        <SkipForward className="size-3" /> Next Ep
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAutoNext(!autoNext)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        autoNext
                          ? "bg-brand/20 text-brand border border-brand/30"
                          : "glass text-slate-400"
                      }`}
                    >
                      Auto-next {autoNext ? "ON" : "OFF"}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="aspect-video grid place-items-center bg-surface rounded-2xl p-6 text-center">
              <p className="text-slate-300 text-sm">Select an episode to start watching.</p>
            </div>
          )}
        </section>
      )}

      {/* Reader with full-screen support */}
      {isReadable && selectedChapter && (
        <section ref={readerRef} className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-white">Reader</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="glass px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
              >
                {fullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
                {fullscreen ? "Exit" : "Fullscreen"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedChapter(null)}
                className="glass px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white"
              >
                Close reader
              </button>
            </div>
          </div>
          {pages.isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="mx-auto w-full max-w-4xl h-[70vh] bg-surface rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : pages.isError ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-slate-300 mb-3">
                This chapter could not be loaded. Try another chapter.
              </p>
              <button
                type="button"
                onClick={() => pages.refetch()}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm text-white flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:gap-3">
              {(pages.data ?? []).map((page, i) => (
                <SmartImage
                  key={page}
                  src={page}
                  alt={`Page ${i + 1}`}
                  className="mx-auto w-full max-w-4xl rounded-lg bg-surface"
                  loading="eager"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Episode grid with ranges */}
      {isWatchable && episodes.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold text-white mb-5 flex items-center gap-3">
            Episodes
            <span className="text-xs font-semibold text-slate-400 glass px-2 py-1 rounded-md">
              {episodes.length.toLocaleString()}
            </span>
          </h2>

          {seasons.length > 0 && (
            <div className="flex gap-1.5 mb-5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSelectedSeason(null);
                  setEpRangeIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedSeason === null
                    ? "bg-brand text-white"
                    : "glass text-slate-400 hover:text-white"
                }`}
              >
                All Seasons
              </button>
              {seasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedSeason(s);
                    setEpRangeIdx(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedSeason === s
                      ? "bg-brand text-white"
                      : "glass text-slate-400 hover:text-white"
                  }`}
                >
                  {seasonLabel || `Season ${s}`}
                </button>
              ))}
              {seasons.length === 1 && seasonLabel && (
                <span className="px-3 py-1.5 text-xs text-slate-500 self-center">
                  ({seasonLabel})
                </span>
              )}
            </div>
          )}

          {epRanges.length > 1 && (
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 flex-wrap">
              {epRanges.map((r, i) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setEpRangeIdx(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap active:scale-90 ${
                    i === epRangeIdx
                      ? "bg-brand text-white"
                      : "glass text-slate-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {info.isLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-3">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="aspect-square bg-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 sm:gap-2.5">
              {visibleEpisodes.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => handlePlayEp(ep)}
                  className={`aspect-square glass rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all active:scale-90 group ${
                    selectedEp === ep.id
                      ? "border-brand text-brand brand-glow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span className="text-[9px] text-slate-500 group-hover:text-brand uppercase tracking-widest">
                    Ep
                  </span>
                  <span className="text-xs sm:text-sm md:text-base font-bold leading-tight">{ep.number}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Chapter grid with ranges */}
      {isReadable && chapters.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold text-white mb-5 flex items-center gap-3">
            Chapters
            <span className="text-xs font-semibold text-slate-400 glass px-2 py-1 rounded-md">
              {chapters.length.toLocaleString()}
            </span>
          </h2>

          {chapterRanges.length > 1 && (
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 flex-wrap">
              {chapterRanges.map((r, i) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setChapterRangeIdx(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap active:scale-90 ${
                    i === chapterRangeIdx
                      ? "bg-brand text-white"
                      : "glass text-slate-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {info.isLoading ? (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 sm:gap-2.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="aspect-square bg-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 sm:gap-2.5">
              {visibleChapters.map((ch, i) => {
                const num = ch.attributes.chapter ?? chapterRangeIdx * PAGE_SIZE + i + 1;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChapter(ch.id)}
                    className={`aspect-square glass rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all active:scale-90 group ${
                      selectedChapter === ch.id
                        ? "border-brand text-brand brand-glow"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <span className="text-[9px] text-slate-500 group-hover:text-brand uppercase tracking-widest">
                      Ch.
                    </span>
                    <span className="text-xs sm:text-sm md:text-base font-bold leading-tight">{num}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!isMovieKind && !episodes.length && !chapters.length && !info.isLoading && (
        <div className="text-center py-16 mb-8">
          {infoData ? (
            <>
              <p className="text-slate-500">
                {isReadable ? "No chapters available" : "No episodes available"} for this title yet.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                The source may not have this content catalogued yet.
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-500">No items available for this title.</p>
              <p className="text-xs text-slate-600 mt-1">
                The source may not have this content catalogued yet.
              </p>
            </>
          )}
        </div>
      )}

      <section>
        <h2 className="font-display text-2xl font-bold text-white mb-5">You may also like</h2>
        {related.isLoading ? (
          <MediaGrid items={[]} />
        ) : related.data && related.data.length > 0 ? (
          <MediaGrid items={related.data} />
        ) : (
          <p className="text-slate-500 text-sm">No related titles found.</p>
        )}
      </section>
    </AppShell>
  );
}
