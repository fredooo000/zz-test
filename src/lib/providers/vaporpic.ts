import axios from "axios";
import * as cheerio from "cheerio";

interface VidnodeLink {
  quality: string;
  url: string;
}

interface VidnodeResult {
  browserLink: string;
  hotlinks: VidnodeLink[];
}

class VidnodeApi {
  private rootUrl = "https://gowatchseries.fm/";

  constructor(
    private mediaType: "movie" | "tvod",
    private title: string,
    private season?: string,
    private episode?: string,
  ) {}

  async assembleSearchUrl(): Promise<string | null> {
    try {
      const searchHtml = (
        await axios.get(`${this.rootUrl}search.html?keyword=${encodeURIComponent(this.title)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        })
      ).data;
      const $ = cheerio.load(searchHtml);
      const results = $("a");

      for (let i = 0; i < results.length; i++) {
        const el = results[i];
        const href = $(el).attr("href") || "";
        const text = $(el).text().toLowerCase();

        if (this.mediaType === "tvod") {
          if (!href.includes("-episode-")) {
            const titleWords = this.title.toLowerCase().split(" ");
            const matchesSeason = !this.season || href.includes(`season-${this.season}`);
            const matchesTitle = titleWords.every((w) => text.includes(w));
            if (matchesSeason && matchesTitle) {
              return href.startsWith("http") ? href : `${this.rootUrl}${href.replace(/^\//, "")}`;
            }
          }
        } else {
          const searchTitle = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          if (href.includes(searchTitle) && !href.includes("-episode-")) {
            return href.startsWith("http") ? href : `${this.rootUrl}${href.replace(/^\//, "")}`;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async assembleMediaUrl(searchUrl: string): Promise<string | null> {
    if (this.mediaType === "tvod") {
      return `${searchUrl}-episode-${this.episode}`;
    }

    try {
      const probeUrl = `${searchUrl}-episode-1`;
      const res = await axios.get(probeUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.data.includes("Page not found")) {
        return `${searchUrl}-episode-0`;
      }
      return probeUrl;
    } catch {
      return `${searchUrl}-episode-0`;
    }
  }

  async scrapeFinalLinks(mediaUrl: string, botMode = false): Promise<VidnodeResult | null> {
    try {
      const html = (
        await axios.get(mediaUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
      ).data;
      const $ = cheerio.load(html);

      const iframeSrc = $("iframe").first().attr("src") || "";
      if (!iframeSrc.includes("vidnode")) return null;

      const iframeHtml = (
        await axios.get(iframeSrc, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
      ).data;
      const $$ = cheerio.load(iframeHtml);

      const scriptContent = $$("script").text();
      const downloadMatch = scriptContent.match(/download_video\s*\([^)]+\)/);
      if (!downloadMatch) return null;

      const downloadUrlMatch = scriptContent.match(
        /['"](https?:\/\/[^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/,
      );
      if (!downloadUrlMatch) return null;

      const linkPageHtml = (
        await axios.get(downloadUrlMatch[1], {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
      ).data;
      const $$$ = cheerio.load(linkPageHtml);

      const links: VidnodeLink[] = [];
      $$$("a").each((_, el) => {
        const href = $$$(el).attr("href") || "";
        const text = $$$(el).text().toLowerCase();
        if (href.includes(".mp4") || href.includes(".m3u8")) {
          let quality = "Original";
          if (text.includes("1080")) quality = "1080p";
          else if (text.includes("720")) quality = "720p";
          else if (text.includes("480")) quality = "480p";
          else if (text.includes("360")) quality = "360p";
          links.push({ quality, url: href });
        }
      });

      return {
        browserLink: downloadUrlMatch[1],
        hotlinks: links,
      };
    } catch {
      return null;
    }
  }
}

export async function searchMovie(query: string) {
  const api = new VidnodeApi("movie", query);
  const searchUrl = await api.assembleSearchUrl();
  if (!searchUrl) return [];

  const mediaUrl = await api.assembleMediaUrl(searchUrl);
  if (!mediaUrl) return [];

  const result = await api.scrapeFinalLinks(mediaUrl);
  if (!result) return [];

  return result.hotlinks.map((l) => ({
    url: l.url,
    quality: l.quality,
    provider: "vidnode",
  }));
}

export async function searchTvShow(query: string, season: string, episode: string) {
  const api = new VidnodeApi("tvod", query, season, episode);
  const searchUrl = await api.assembleSearchUrl();
  if (!searchUrl) return [];

  const mediaUrl = await api.assembleMediaUrl(searchUrl);
  if (!mediaUrl) return [];

  const result = await api.scrapeFinalLinks(mediaUrl);
  if (!result) return [];

  return result.hotlinks.map((l) => ({
    url: l.url,
    quality: l.quality,
    provider: "vidnode",
  }));
}
