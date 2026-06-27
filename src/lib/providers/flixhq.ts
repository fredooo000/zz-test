import FlixHQ from "@consumet/extensions/dist/providers/movies/flixhq";
import { withTimeout } from "@/lib/utils";

class MyFlixHQ extends FlixHQ {
  constructor() {
    super();
    this.baseUrl = "https://flixhq.ru";
  }
}

const flix = new MyFlixHQ();

export async function searchFlixHQ(query: string, type?: "movie" | "tv") {
  try {
    const res = await withTimeout(flix.search(query), 3000);
    const results = res?.results;
    if (results && results.length > 0) {
      return results
        .filter((r: any) => !type || r.type === type)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          image: r.image,
          type: r.type,
          rating: r.rating,
          year: r.releaseDate,
          description: r.description,
        }));
    }
  } catch (err) {
    console.warn("FlixHQ search failed:", (err as Error).message);
  }
  return [];
}

export async function getFlixHQStream(mediaId: string) {
  try {
    const info = await withTimeout(flix.fetchMediaInfo(mediaId), 3000);
    const episodes = info?.episodes;
    if (episodes && episodes.length > 0) {
      const firstEp = episodes[0] as any;
      const epId = firstEp.id;
      const res = await flix.fetchEpisodeSources(epId, mediaId);
      if (res?.sources?.length > 0) {
        return res.sources.map((s: any) => ({
          url: s.url,
          quality: s.quality || "auto",
          isM3U8: s.isM3U8 || s.url.includes(".m3u8"),
          isDASH: s.isDASH || false,
        }));
      }
    }
  } catch (err) {
    console.warn("FlixHQ stream failed:", (err as Error).message);
  }
  return [];
}

export async function getFlixHQTvStream(mediaId: string, season: string, episode: string) {
  try {
    const info = await withTimeout(flix.fetchMediaInfo(mediaId), 3000);
    const episodes = info?.episodes as any[];
    if (episodes && episodes.length > 0) {
      const ep = episodes.find(
        (e: any) => String(e.season) === season && String(e.episode) === episode,
      );
      if (ep) {
        const res = await flix.fetchEpisodeSources(ep.id, mediaId);
        if (res?.sources?.length > 0) {
          return res.sources.map((s: any) => ({
            url: s.url,
            quality: s.quality || "auto",
            isM3U8: s.isM3U8 || s.url.includes(".m3u8"),
            isDASH: s.isDASH || false,
          }));
        }
      }
    }
  } catch (err) {
    console.warn("FlixHQ TV stream failed:", (err as Error).message);
  }
  return [];
}
