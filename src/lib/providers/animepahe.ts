import AnimePahe from "@consumet/extensions/dist/providers/anime/animepahe";
import axios from "axios";
import { withTimeout } from "@/lib/utils";

class MyAnimePahe extends AnimePahe {
  constructor() {
    super();
    this.baseUrl = "https://animepahe.pw";
    this.client.defaults.headers.common["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    this.client.defaults.headers.common["Accept"] = "application/json, text/plain, */*";
    this.client.defaults.headers.common["Referer"] = "https://animepahe.pw/";
  }
}

const pahe = new MyAnimePahe();

export interface AnimeResult {
  id: string;
  title: string;
  image?: string;
  subEpisodes?: number;
  dubEpisodes?: number;
  type?: string;
  status?: string;
  synopsis?: string;
}

export interface EpisodeResult {
  number: number;
  title?: string;
  episodeString: string;
  consumetId: string;
  image?: string;
}

export interface AnimeMeta {
  title: string;
  description?: string;
  image?: string;
  type?: string;
  status?: string;
  genres: string[];
  score?: number;
}

export interface StreamSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  isDASH: boolean;
}

export async function searchAnime(query: string): Promise<AnimeResult[]> {
  try {
    const res = await withTimeout(pahe.search(query), 3000);
    const results = res?.results;
    if (results && results.length > 0) {
      return results.map((a: any) => ({
        id: a.id,
        title: a.title,
        image: a.image,
        subEpisodes: a.subOrDub === "dub" ? 0 : a.episodes || 0,
        dubEpisodes: a.subOrDub === "dub" ? a.episodes || 0 : 0,
        type: a.type,
        status: a.status,
      }));
    }
  } catch (err) {
    console.warn("AnimePahe search failed:", (err as Error).message);
  }
  return [];
}

export async function getAnimeEpisodes(
  animeId: string,
): Promise<{ episodes: EpisodeResult[]; meta: AnimeMeta | null }> {
  try {
    const info = await withTimeout(pahe.fetchAnimeInfo(animeId), 3000);
    const epList = info?.episodes;
    if (epList && epList.length > 0) {
      let offset = 0;
      if (epList[0]?.number > 1) {
        offset = epList[0].number - 1;
      }

      const episodes: EpisodeResult[] = epList.map((ep: any) => {
        const relativeNum = ep.number !== undefined ? ep.number - offset : ep.number || 0;
        return {
          number: relativeNum,
          title: ep.title,
          episodeString: String(relativeNum),
          consumetId: ep.id,
          image: ep.image,
        };
      });

      const rawTitle = info?.title;
      const titleStr =
        typeof rawTitle === "string"
          ? rawTitle
          : typeof rawTitle === "object" && rawTitle !== null
            ? Object.values(rawTitle)[0] || ""
            : "";
      const meta: AnimeMeta = {
        title: titleStr,
        description: info?.description ? info.description.replace(/<[^>]*>?/gm, "").trim() : "",
        image: info?.image,
        type: info?.type,
        status: info?.status,
        genres: (info?.genres || []) as string[],
        score: info?.rating || info?.score,
      };

      return { episodes, meta };
    }
  } catch (err) {
    console.warn("AnimePahe episodes failed:", (err as Error).message);
  }
  return { episodes: [], meta: null };
}

export async function getAnimeStreams(consumetId: string): Promise<StreamSource[]> {
  try {
    const streamsData = await withTimeout(pahe.fetchEpisodeSources(consumetId), 3000);
    if (streamsData?.sources?.length > 0) {
      return streamsData.sources.map((src: any) => ({
        url: src.url,
        quality: src.quality || "auto",
        isM3U8: src.isM3U8 || src.url.includes(".m3u8"),
        isDASH: src.isDASH || false,
      }));
    }
  } catch (err) {
    console.warn("AnimePahe streams failed:", (err as Error).message);
  }
  return [];
}

export async function getAnimeHome() {
  const apiBase = "https://animepahe.pw";
  try {
    const [p1, p2] = await Promise.all([
      axios.get(`${apiBase}/api?m=airing&page=1`),
      axios.get(`${apiBase}/api?m=airing&page=2`),
    ]);

    const raw = [...(p1?.data?.data || []), ...(p2?.data?.data || [])];

    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const a of raw) {
      const key = a.anime_session || a.session;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push({
          id: key,
          title: a.anime_title || a.title,
          image: a.poster || a.snapshot,
          type: "TV",
          description: a.synopsis || "",
          status: "Airing",
        });
      }
    }

    const spotlight = deduped.slice(0, 5);
    const trending = deduped.slice(0, 10);
    const latest = deduped.slice(5);

    return { spotlight, trending, latest };
  } catch {
    try {
      const searchRes = await pahe.search("a");
      const items = searchRes?.results?.slice(0, 15) || [];
      const trending = items.map((a: any) => ({
        id: a.id,
        title: a.title,
        image: a.image,
        type: a.type || "TV",
      }));
      const spotlight = items.slice(0, 5).map((a: any) => ({
        id: a.id,
        title: a.title,
        image: a.image,
        type: a.type || "TV",
        description: a.description || "",
      }));
      return { spotlight, trending, latest: trending.slice(5) };
    } catch {
      return { spotlight: [], trending: [], latest: [] };
    }
  }
}
