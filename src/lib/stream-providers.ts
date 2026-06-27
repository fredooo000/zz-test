"use client";

export interface ServerDefinition {
  id: string;
  name: string;
  shortLabel: string;
  color: string;
  /** Which source IDs are required */
  requires?: ("malId" | "tmdbId")[];
  /**
   * Iframe sandbox attribute value. Set to empty string or undefined to disable sandbox.
   * Defaults to the standard sandbox values when omitted.
   */
  sandbox?: string;
  /**
   * Build the embed URL.
   * - For anime: anilistId = number, episode = ep string, meta?.malId
   * - For movies/TV: anilistId = TMDB id, episode = ep string, meta?.tmdbId
   */
  buildUrl: (anilistId: number, episode: string, meta?: AnilistMeta) => string | null;
}

export interface AnilistMeta {
  malId?: number;
  tmdbId?: number;
}

const META_CACHE = new Map<number, AnilistMeta>();
const ANILIST_API = "https://graphql.anilist.co";

function extractTmdbId(links: { site: string; url: string }[]): number | undefined {
  const tmdb = links?.find((l) => l.site === "The Movie Database" || l.site?.includes("TMDB"));
  if (!tmdb?.url) return;
  const m = tmdb.url.match(/\/tv\/(\d+)/) || tmdb.url.match(/\/movie\/(\d+)/);
  return m ? parseInt(m[1]) : undefined;
}

export async function fetchAnilistMeta(anilistId: number): Promise<AnilistMeta> {
  if (META_CACHE.has(anilistId)) return META_CACHE.get(anilistId)!;

  if (typeof window !== "undefined") {
    try {
      const cached = sessionStorage.getItem(`al-meta:${anilistId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as AnilistMeta;
        META_CACHE.set(anilistId, parsed);
        return parsed;
      }
    } catch {}
  }

  const query = {
    query: `query ($id: Int) { Media(id: $id) { id idMal externalLinks { site url } } }`,
    variables: { id: anilistId },
  };

  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const media = data.data?.Media;
    if (!media) return {};

    const meta: AnilistMeta = {
      malId: media.idMal || undefined,
      tmdbId: extractTmdbId(media.externalLinks),
    };

    META_CACHE.set(anilistId, meta);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`al-meta:${anilistId}`, JSON.stringify(meta));
      } catch {}
    }
    return meta;
  } catch {
    return {};
  }
}

// ── Anime servers (MegaPlay / Dropfile / VidNest) ──────────────

export const ANIME_SERVERS: ServerDefinition[] = [
  {
    id: "megaplay",
    name: "MegaPlay",
    shortLabel: "MP",
    color: "#F59E0B",
    buildUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/sub`,
  },
  {
    id: "megaplay-dub",
    name: "MegaPlay Dub",
    shortLabel: "DUB",
    color: "#22D3A5",
    buildUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/dub`,
  },
  {
    id: "dropfile",
    name: "Dropfile",
    shortLabel: "DF",
    color: "#8B5CF6",
    buildUrl: (id, ep) => `https://dropfile.cc/player/tv/anilist-${id}/1/${ep}`,
  },
  {
    id: "vidlink-anime",
    name: "VidLink",
    shortLabel: "VL",
    color: "#10B981",
    requires: ["malId"],
    buildUrl: (id, ep, meta) => {
      if (!meta?.malId) return null;
      return `https://vidlink.pro/anime/${meta.malId}/${ep}/sub`;
    },
  },
];

// ── Movie / TV servers (TMDB-based) ────────────────────────────

export const MOVIE_SERVERS: ServerDefinition[] = [
  {
    id: "vidlink",
    name: "VidLink",
    shortLabel: "VL",
    color: "#10B981",
    sandbox: "",
    buildUrl: (id, _ep) => `https://vidlink.pro/movie/${id}`,
  },
  {
    id: "vidsrc",
    name: "Vidsrc",
    shortLabel: "VS",
    color: "#EC4899",
    buildUrl: (id, _ep) => `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    id: "vidfast",
    name: "VidFast",
    shortLabel: "VF",
    color: "#3B82F6",
    sandbox: "",
    buildUrl: (id, _ep) => `https://vidfast.pro/movie/${id}?autoPlay=true`,
  },
  {
    id: "vixsrc",
    name: "VixSrc",
    shortLabel: "VX",
    color: "#A855F7",
    sandbox: "",
    buildUrl: (id, _ep) => `https://vixsrc.to/movie/${id}`,
  },
];

export const TV_SERVERS: ServerDefinition[] = [
  {
    id: "vidlink-tv",
    name: "VidLink",
    shortLabel: "VL",
    color: "#10B981",
    sandbox: "",
    buildUrl: (id, ep) => `https://vidlink.pro/tv/${id}/${ep}`,
  },
  {
    id: "vidsrc-tv",
    name: "Vidsrc",
    shortLabel: "VS",
    color: "#EC4899",
    buildUrl: (id, ep) => `https://vidsrc.to/embed/tv/${id}/${ep}`,
  },
  {
    id: "vidfast-tv",
    name: "VidFast",
    shortLabel: "VF",
    color: "#3B82F6",
    sandbox: "",
    buildUrl: (id, ep) => `https://vidfast.pro/tv/${id}/${ep}?autoPlay=true`,
  },
  {
    id: "vixsrc-tv",
    name: "VixSrc",
    shortLabel: "VX",
    color: "#A855F7",
    sandbox: "",
    buildUrl: (id, ep) => `https://vixsrc.to/tv/${id}/${ep}`,
  },
];

// Legacy - used by anime title page
export const STREAM_SERVERS = ANIME_SERVERS;
