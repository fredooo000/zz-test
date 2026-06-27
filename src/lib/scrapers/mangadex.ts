import axios from "axios";

const API = "https://api.mangadex.org";
const api = axios.create({
  timeout: 8000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    Accept: "application/json",
  },
});
const COVER_URL = "https://uploads.mangadex.org/covers";

export interface MangaResult {
  id: string;
  title: string;
  cover?: string;
  description?: string;
  status?: string;
  year?: number;
  tags: string[];
}

export interface ChapterResult {
  id: string;
  number: number;
  title?: string;
  volume?: number;
  pages: number;
}

export async function searchMangaDex(query: string, limit = 20): Promise<MangaResult[]> {
  try {
    const res = await api.get(`${API}/manga`, {
      params: {
        title: query,
        limit,
        "order[relevance]": "desc",
        contentRating: ["safe", "suggestive", "erotica"],
        includes: ["cover_art"],
      },
    });

    return (res.data.data || []).map((manga: any) => {
      const title =
        manga.attributes.title.en || Object.values(manga.attributes.title)[0] || "Unknown";
      const coverRel = (manga.relationships || []).find((r: any) => r.type === "cover_art");
      const cover = coverRel
        ? `${COVER_URL}/${manga.id}/${coverRel.attributes.fileName}.256.jpg`
        : undefined;

      const allTags = manga.attributes.tags || [];
      const tags = allTags.map((t: any) => t.attributes?.name?.en || "").filter((t: string) => t);

      return {
        id: manga.id,
        title,
        cover,
        description:
          manga.attributes.description?.en ||
          Object.values(manga.attributes.description || {})[0] ||
          "",
        status: manga.attributes.status || "",
        year: manga.attributes.year,
        tags,
      };
    });
  } catch (err) {
    console.warn("MangaDex search failed:", (err as Error).message);
    return [];
  }
}

export interface MangaDetail {
  id: string;
  title: string;
  cover: string;
  description: string;
  status: string;
  tags: string[];
}

export async function getMangaDexManga(mangaId: string): Promise<MangaDetail | null> {
  try {
    const res = await api.get(`${API}/manga/${mangaId}`, {
      params: {
        includes: ["cover_art"],
      },
    });
    const manga = res.data.data;
    if (!manga) return null;

    const title =
      manga.attributes.title.en || Object.values(manga.attributes.title)[0] || "Unknown";
    const coverRel = (manga.relationships || []).find((r: any) => r.type === "cover_art");
    const cover = coverRel
      ? `${COVER_URL}/${manga.id}/${coverRel.attributes.fileName}.512.jpg`
      : "";

    const allTags = manga.attributes.tags || [];
    const tags = allTags.map((t: any) => t.attributes?.name?.en || "").filter((t: string) => t);

    return {
      id: manga.id,
      title,
      cover,
      description:
        manga.attributes.description?.en ||
        Object.values(manga.attributes.description || {})[0] ||
        "",
      status: manga.attributes.status || "",
      tags,
    };
  } catch (err) {
    console.warn("MangaDex manga fetch failed:", (err as Error).message);
    return null;
  }
}

export async function getMangaDexChapters(mangaId: string, limit = 500): Promise<ChapterResult[]> {
  const allChapters: ChapterResult[] = [];
  let offset = 0;
  const PAGE_SIZE = 500;

  try {
    while (allChapters.length < limit) {
      const res = await api.get(`${API}/manga/${mangaId}/feed`, {
        params: {
          limit: PAGE_SIZE,
          offset,
          "order[chapter]": "desc",
          translatedLanguage: ["en"],
          contentRating: ["safe", "suggestive", "erotica"],
          "order[volume]": "desc",
        },
      });

      const chapters = (res.data.data || []).map((ch: any) => ({
        id: ch.id,
        number: parseFloat(ch.attributes.chapter) || 0,
        title: ch.attributes.title || "",
        volume: ch.attributes.volume ? parseFloat(ch.attributes.volume) : undefined,
        pages: ch.attributes.pages || 0,
      }));

      if (chapters.length === 0) break;

      allChapters.push(...chapters);

      const total = res.data.total || 0;
      offset += PAGE_SIZE;

      if (offset >= total) break;
    }

    return allChapters;
  } catch (err) {
    console.warn("MangaDex chapters failed:", (err as Error).message);
    return allChapters;
  }
}

export async function getMangaDexPages(chapterId: string): Promise<string[]> {
  try {
    const res = await api.get(`${API}/at-home/server/${chapterId}`);
    const { baseUrl, chapter } = res.data;
    const hash = chapter.hash;
    return (chapter.data || []).map((page: string) => `${baseUrl}/data/${hash}/${page}`);
  } catch (err) {
    console.warn("MangaDex pages failed:", (err as Error).message);
    return [];
  }
}
