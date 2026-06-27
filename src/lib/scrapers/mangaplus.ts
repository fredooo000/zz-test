import axios from "axios";

const API = "https://jumpg-webapi.tokyo-cdn.animestreamcdn.com/api";

export interface MangaPlusResult {
  id: number;
  title: string;
  cover?: string;
  author?: string;
  description?: string;
}

export interface MangaPlusChapter {
  id: number;
  number: number;
  title: string;
  subTitle?: string;
}

export async function searchMangaPlus(query: string): Promise<MangaPlusResult[]> {
  try {
    const res = await axios.get(`${API}/search`, {
      params: { word: query },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en",
      },
    });

    const mangas = res.data?.success?.mangaSearch?.manga || [];
    return mangas
      .filter((m: any) => m.language === "en")
      .map((m: any) => ({
        id: m.mangaId,
        title: m.name,
        cover: m.portraitImageUrl || m.thumbnailUrl,
        author: m.author,
        description: "",
      }));
  } catch (err) {
    console.warn("MangaPlus search failed:", (err as Error).message);
    return [];
  }
}

export async function getMangaPlusDetail(mangaId: number): Promise<{
  chapters: MangaPlusChapter[];
  title: string;
  cover?: string;
  description?: string;
} | null> {
  try {
    const res = await axios.get(`${API}/manga_detail`, {
      params: { manga_id: mangaId },
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const detail = res.data?.success?.mangaDetail;
    if (!detail) return null;

    const allChapters = [...(detail.chapters || []), ...(detail.firstChapterList || [])];

    return {
      title: detail.title?.name || "",
      cover: detail.title?.portraitImageUrl || "",
      description: "",
      chapters: allChapters.map((ch: any) => ({
        id: ch.chapterId,
        number: ch.chapterNumber,
        title: ch.name,
        subTitle: ch.subTitle,
      })),
    };
  } catch (err) {
    console.warn("MangaPlus detail failed:", (err as Error).message);
    return null;
  }
}

export async function getMangaPlusPages(chapterId: number): Promise<string[]> {
  try {
    const res = await axios.get(`${API}/manga_viewer`, {
      params: {
        chapter_id: chapterId,
        split: "yes",
        img_quality: "high",
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const pages = res.data?.success?.mangaViewer?.pages || [];
    return pages
      .filter((p: any) => p.type === "page")
      .map((p: any) => p.imageUrl || p.url)
      .filter(Boolean);
  } catch (err) {
    console.warn("MangaPlus pages failed:", (err as Error).message);
    return [];
  }
}
