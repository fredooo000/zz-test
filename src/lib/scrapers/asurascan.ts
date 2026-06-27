const API = "https://api.asurascans.com/api";

// ─── Types ─────────────────────────────────────────────────

export interface AsuraScanResult {
  id: string;
  slug: string;
  publicSlug?: string;
  title: string;
  cover?: string;
  rating?: number;
  status?: string;
  genres: string[];
  chapterCount: number;
}

export interface AsuraScanChapter {
  id: string;
  number: number;
  title: string;
}

export interface AsuraScanSeries {
  title: string;
  cover?: string;
  description?: string;
  genres: string[];
  rating?: number;
  status?: string;
  chapters: AsuraScanChapter[];
}

// ─── Helpers ───────────────────────────────────────────────

const HEADERS = {
  "User-Agent": "Kyrox/1.0",
  Accept: "application/json",
};

async function apiGet<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const SITE = "https://asurascans.com";
const SITE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  Referer: "https://asurascans.com/",
};

// public_url looks like "/comics/<slug>-<hash>". The reader site
// (asurascans.com) addresses series by that hashed slug, so we keep it for
// building chapter URLs. Falls back to the bare API slug.
function publicSlugFrom(s: any): string {
  const pu: string = s?.public_url || "";
  const m = pu.match(/\/comics\/(.+)$/);
  return m ? m[1] : s?.slug;
}

function mapSeries(s: any): AsuraScanResult {
  return {
    id: String(s.id),
    slug: s.slug,
    publicSlug: publicSlugFrom(s),
    title: s.title,
    cover: s.cover,
    rating: s.rating,
    status: s.status,
    genres: (s.genres || []).map((g: any) => g.name || g),
    chapterCount: s.chapter_count || 0,
  };
}

// ─── Browse (manhwa list) ──────────────────────────────────

export async function getAsuraScanList(
  page = 1,
  perPage = 20,
): Promise<{ items: AsuraScanResult[]; hasMore: boolean }> {
  const data = await apiGet<{ data: any[] }>(
    `/series?perPage=${perPage}&page=${page}&type=manhwa`,
  );
  const rows = data?.data ?? [];
  return {
    items: rows.filter((s) => s.type === "manhwa").map(mapSeries),
    hasMore: rows.length >= perPage,
  };
}

// ─── Search (manhwa only) ──────────────────────────────────

export async function searchAsuraScan(
  query: string,
): Promise<AsuraScanResult[]> {
  const data = await apiGet<{ data: any[] }>(
    `/series?perPage=20&search=${encodeURIComponent(query)}`,
  );
  if (!data?.data) return [];
  return data.data.filter((s: any) => s.type === "manhwa").map(mapSeries);
}

// ─── Series info (title, cover, chapters) ──────────────────

export async function getAsuraScanSeries(
  slugOrId: string,
): Promise<AsuraScanSeries | null> {
  // Our ids are hyphenated slugs (e.g. "the-berserkers-second-playthrough");
  // the API search matches on title words, so convert hyphens to spaces.
  const query = slugOrId.replace(/-/g, " ").trim();
  const data = await apiGet<{ data: any[] }>(
    `/series?perPage=5&search=${encodeURIComponent(query)}`,
  );
  const rows = (data?.data ?? []).filter((s: any) => s.type === "manhwa");
  if (!rows.length) return null;
  // Prefer an exact slug match; otherwise take the top (most relevant) result.
  const s = rows.find((r: any) => r.slug === slugOrId) ?? rows[0];

  const publicSlug = publicSlugFrom(s);
  const count = s.chapter_count || 0;
  const chapters: AsuraScanChapter[] = [];
  // Newest first, matching how chapters are listed elsewhere.
  for (let i = count; i >= 1; i--) {
    chapters.push({
      id: `${publicSlug}/${i}`,
      number: i,
      title: `Chapter ${i}`,
    });
  }

  return {
    title: s.title,
    cover: s.cover,
    description: (s.description || "").replace(/<[^>]+>/g, ""),
    genres: (s.genres || []).map((g: any) => g.name || g),
    rating: s.rating,
    status: s.status,
    chapters,
  };
}

// ─── Chapter pages (scrape the reader page) ────────────────
// AsuraScans serves chapter images with hashed, non-sequential filenames, so
// they can't be enumerated. We fetch the chapter reader page and pull the
// ordered image list embedded in its HTML.

function extractChapterImages(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  // Page images live under .../asura-images/chapters/<slug>/<n>/<hash>.webp,
  // which cleanly excludes covers, banners and the site logo.
  const re =
    /https?:\\?\/\\?\/[a-z0-9.-]*asurascans\.com\\?\/asura-images\\?\/chapters\\?\/[^"'\\\s)]+?\.(?:webp|jpg|jpeg|png)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[0].replace(/\\\//g, "/");
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

export async function getAsuraScanPages(
  chapterId: string,
): Promise<string[]> {
  // chapterId == "<public-slug>/<chapterNumber>"
  const idx = chapterId.lastIndexOf("/");
  if (idx < 0) return [];
  const publicSlug = chapterId.slice(0, idx);
  const chapter = chapterId.slice(idx + 1);
  if (!publicSlug || !chapter) return [];
  try {
    // The API's public_url hash can be stale, but asurascans.com 301-redirects
    // the old hash to the current one, so this still resolves correctly.
    const res = await fetch(`${SITE}/comics/${publicSlug}/chapter/${chapter}`, {
      headers: SITE_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    return extractChapterImages(await res.text());
  } catch {
    return [];
  }
}
