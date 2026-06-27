const ORIGIN = typeof window === "undefined" ? "" : "";
const API = `${ORIGIN}/api/public/anikoto`;

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}

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

export interface AnikotoEpisode {
  episode_embed_id: string;
  episode_no: number;
  title?: string;
}

export interface AnikotoSeries {
  id: string;
  title: string;
  image?: string;
  description?: string;
  episodes?: AnikotoEpisode[];
  total_episodes?: number;
}

export async function fetchAnikotoSeries(id: string): Promise<AnikotoSeries> {
  const raw = await jget<AnikotoSeriesRaw>(`${API}/series/${id}`);
  if (!raw.data) throw new Error("Anikoto returned no data");
  const anime = raw.data?.anime;
  const rawEps = raw.data?.episodes ?? [];
  return {
    id: String(anime?.id ?? id),
    title: anime?.title ?? "Unknown",
    image: anime?.poster || anime?.background_image,
    description: anime?.description,
    episodes: rawEps.map((ep) => ({
      episode_embed_id: String(ep.episode_embed_id),
      episode_no: ep.number,
      title: ep.title,
    })),
    total_episodes: anime?.episodes ? parseInt(anime.episodes) : rawEps.length,
  };
}

export async function fetchRecentAnime(page = 1, perPage = 20): Promise<AnikotoSeries[]> {
  const data = await jget<{ results?: AnikotoSeries[] }>(
    `${API}/recent-anime?page=${page}&per_page=${perPage}`,
  );
  return data.results ?? [];
}
