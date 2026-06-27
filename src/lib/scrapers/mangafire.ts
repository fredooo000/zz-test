import * as cheerio from "cheerio";

export function extractSlug(href: string): string {
  const m = href.match(/\/manga\/([^/]+)/);
  return m ? m[1] : href.split("/").filter(Boolean).pop() || "";
}

export function extractSuffix(slug: string): string {
  const parts = slug.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : slug;
}

export interface MfCategoryResult {
  id: string;
  title: string;
  poster: string;
  type: string;
}

export function parseCategoryPage(html: string): {
  items: MfCategoryResult[];
  total: number;
  hasNextPage: boolean;
} {
  const $ = cheerio.load(html);
  const items: MfCategoryResult[] = [];

  $("div.original.card-lg > div.unit").each((_, el) => {
    const link = $(el).find("a.poster");
    const href = link.attr("href") || "";
    const slug = extractSlug(href);
    const title = $(el).find("div.info > a").text().trim();
    const poster = $(el).find("a.poster > div > img").attr("src")?.trim() || "";
    const type = $(el).find("div.info > div > span.type").text().trim() || "";

    if (slug && title) {
      items.push({ id: slug, title, poster, type });
    }
  });

  const totalText = $("section.mt-5 > .head > span").text().trim();
  const totalMatch = totalText.match(/([\d,]+)/);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, "")) : 0;

  const onPage = items.length;
  const totalPages = total > 0 && onPage > 0 ? Math.ceil(total / onPage) : 1;

  return { items, total, hasNextPage: false };
}

export interface MfMangaInfo {
  title: string;
  altTitles: string;
  poster: string;
  status: string;
  type: string;
  description: string;
  genres: string[];
  rating: string;
}

export function parseMangaDetail(html: string): MfMangaInfo {
  const $ = cheerio.load(html);
  return {
    title: $('h1[itemprop="name"]').text().trim(),
    altTitles: $('h1[itemprop="name"]').siblings("h6").text().trim() || "",
    poster: $(".poster img").attr("src")?.trim() || "",
    status: $(".info > p").first().text().trim(),
    type: $(".min-info a").first().text().trim(),
    description: $(".description").text().replace("Read more +", "").trim(),
    genres: $(".meta div:contains('Genres:') a")
      .map((_, el) => $(el).text().trim())
      .get(),
    rating: $(".rating-box .live-score").text().trim() || "",
  };
}

export interface MfChapter {
  number: string;
  title: string;
  chapterId: string;
  language: string;
  releaseDate: string | null;
}

export function parseChapterList(json: { result: { html: string } }): MfChapter[] {
  const $ = cheerio.load(json.result.html);
  const chapters: MfChapter[] = [];
  $("li").each((_, li) => {
    const a = $(li).find("a");
    const title = a.find("span:first-child").text().trim();
    const releaseDate = a.find("span:last-child").text().trim() || null;
    chapters.push({
      number: a.attr("data-number") ?? "",
      title,
      chapterId: a.attr("data-id") ?? "",
      language: "en",
      releaseDate,
    });
  });
  return chapters;
}

export function parseChapterImages(json: { result: { images: string[][] } }): string[] {
  return json.result.images.map((img) => img[0]);
}

export function scrapeCategoryPage(
  html: string,
  kind: string,
): {
  items: Array<{
    id: string;
    title: string;
    kind: string;
    genre: string;
    badge: string;
    image: string;
  }>;
  hasMore: boolean;
} {
  const { items } = parseCategoryPage(html);
  const mediaKind = kind === "manhwa" ? "manhwa" : "manga";
  return {
    items: items.map((m) => ({
      id: `${mediaKind}:${m.id}`,
      title: m.title,
      kind: mediaKind,
      genre: m.type || "Manga",
      badge: "MANGA",
      image: m.poster,
    })),
    hasMore: items.length >= 20,
  };
}

export function titleMatchScore(title: string, query: string): number {
  const t = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t === q) return 5;
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 1;
  return 0;
}
