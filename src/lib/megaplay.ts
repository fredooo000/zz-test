const ORIGIN = typeof window === "undefined" ? "" : "";
const API = `${ORIGIN}/api/public/megaplay`;

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}

// MegaPlay uses the Anikoto API for discovery (docs: https://megaplay.buzz/api).
// Endpoints follow Anikoto's format since MegaPlay hosts the same library.

type AnikotoEpisodeRaw = {
  id: number;
  number: number;
  title?: string;
  episode_embed_id: string;
  embed_url?: { sub?: string; dub?: string };
};

type AnikotoSeriesRaw = {
  ok: boolean;
  data: {
    anime: {
      id: number;
      title: string;
      poster?: string;
      background_image?: string;
      description?: string;
      episodes?: string;
    };
    episodes: AnikotoEpisodeRaw[];
  };
};

export interface MegaPlayEpisode {
  id: string | number;
  number: number;
  title?: string;
  embed_id?: string;
}

export interface MegaPlayAnimeInfo {
  id: string;
  title: string;
  image?: string;
  cover?: string;
  description?: string;
  genres?: string[];
  rating?: number;
  totalEpisodes?: number;
  episodes: MegaPlayEpisode[];
}

export async function fetchMegaPlayAnime(anilistId: string): Promise<MegaPlayAnimeInfo | null> {
  try {
    const raw = await jget<AnikotoSeriesRaw>(`${API}/series/${anilistId}`);
    if (!raw.data) return null;
    const anime = raw.data.anime;
    const rawEps = raw.data.episodes ?? [];
    if (!rawEps.length) return null;
    return {
      id: String(anime?.id ?? anilistId),
      title: anime?.title ?? "Unknown",
      image: anime?.poster || anime?.background_image,
      cover: anime?.background_image,
      description: anime?.description,
      totalEpisodes: anime?.episodes ? parseInt(anime.episodes) : rawEps.length,
      episodes: rawEps.map((ep) => ({
        id: String(ep.episode_embed_id),
        number: ep.number,
        title: ep.title,
        embed_id: String(ep.episode_embed_id),
      })),
    };
  } catch {
    return null;
  }
}
