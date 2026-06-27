import axios from "axios";
import * as cheerio from "cheerio";

// Route through our same-origin proxy to avoid CORS / bot blocks.
const PROXY = "/api/public/toonily";

export interface ToonilyResult {
  id: string;
  title: string;
  cover?: string;
  rating?: string;
  status?: string;
  genres: string[];
}

export interface ToonilyChapter {
  id: string;
  number: number;
  title: string;
  date?: string;
}

// Extract the series slug from a Toonily series URL (e.g.
// https://toonily.com/webtoon/solo-leveling/ -> "solo-leveling").
function seriesSlug(href: string): string {
  const m = href.match(/\/webtoon\/([^/]+)/);
  return m ? m[1] : href.split("/").filter(Boolean).pop() || "";
}

export async function searchToonily(query: string): Promise<ToonilyResult[]> {
  try {
    const html = (
      await axios.get(`${PROXY}/search/${encodeURIComponent(query)}/`, {
        timeout: 12000,
      })
    ).data as string;
    const $ = cheerio.load(html);

    const results: ToonilyResult[] = [];

    $(".page-item-detail").each((_, el) => {
      const link = $(el).find("a").first();
      const href = link.attr("href") || "";
      const id = seriesSlug(href);
      const title = link.attr("title") || $(el).find(".h4, .post-title").text().trim();
      const img = $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || "";
      const rating = $(el).find(".rating, .score").first().text().trim();

      if (id && title) {
        results.push({
          id,
          title,
          cover: img,
          rating: rating || undefined,
          genres: [],
        });
      }
    });

    return results;
  } catch (err) {
    console.warn("Toonily search failed:", (err as Error).message);
    return [];
  }
}

// Extract the "<series>/<chapter>" path from a chapter URL so the page
// fetcher can rebuild the full URL (the old code dropped the series slug).
function chapterPath(href: string): string {
  const m = href.match(/\/webtoon\/(.+?)\/?$/);
  return m ? m[1] : href.split("/").filter(Boolean).slice(-2).join("/");
}

export async function getToonilyChapters(
  mangaId: string,
): Promise<{ chapters: ToonilyChapter[]; title: string; cover?: string; description?: string }> {
  try {
    const html = (await axios.get(`${PROXY}/webtoon/${mangaId}/`, { timeout: 12000 }))
      .data as string;
    const $ = cheerio.load(html);

    const title = $(".profile-manga .post-title h1").text().trim() || mangaId;
    const cover =
      $(".profile-manga img").first().attr("data-src") ||
      $(".profile-manga img").first().attr("src") ||
      "";
    const description = $(".description-summary p").first().text().trim();

    const chapters: ToonilyChapter[] = [];
    $(".wp-manga-chapter a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const chId = chapterPath(href);
      const chText = $(el).text().trim();
      const numMatch = chText.match(/Chapter\s*([\d.]+)/i);
      const number = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;

      if (chId) {
        chapters.push({
          id: chId,
          number,
          title: chText,
        });
      }
    });

    // Toonily lists newest-first; return ascending by chapter number.
    chapters.sort((a, b) => a.number - b.number);

    return {
      chapters,
      title,
      cover,
      description: description || undefined,
    };
  } catch (err) {
    console.warn("Toonily chapters failed:", (err as Error).message);
    return { chapters: [], title: mangaId };
  }
}

export async function getToonilyPages(chapterId: string): Promise<string[]> {
  try {
    const html = (await axios.get(`${PROXY}/webtoon/${chapterId}/`, { timeout: 12000 }))
      .data as string;
    const $ = cheerio.load(html);

    const pages: string[] = [];
    $(".reading-content img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || $(el).attr("data-lazy-src") || "";
      if (src) pages.push(src);
    });

    return pages;
  } catch (err) {
    console.warn("Toonily pages failed:", (err as Error).message);
    return [];
  }
}
