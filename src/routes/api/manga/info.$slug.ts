import { createFileRoute } from "@tanstack/react-router";
import { parseMangaDetail, parseChapterList, extractSuffix } from "@/lib/scrapers/mangafire";
import { getAsuraScanSeries } from "@/lib/scrapers/asurascan";

const MANGAFIRE = "https://mangafire.to";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: MANGAFIRE + "/",
};

async function fetchMangaFireInfo(slug: string) {
  // Fetch detail page first (critical for all metadata)
  const detailRes = await fetch(`${MANGAFIRE}/manga/${slug}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!detailRes.ok) throw new Error(`Mangafire ${detailRes.status}`);

  const detail = parseMangaDetail(await detailRes.text());

  // Fetch chapters separately — failure here should still return metadata
  let chapters: Array<{ id: string; attributes: { chapter?: string; title?: string } }> = [];
  try {
    const chapterRes = await fetch(`${MANGAFIRE}/ajax/read/${extractSuffix(slug)}/chapter/en`, {
      headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" },
      signal: AbortSignal.timeout(10000),
    });
    if (chapterRes.ok) {
      const chapterJson = await chapterRes.json();
      const parsed = parseChapterList(chapterJson);
      chapters = parsed.map((c) => ({
        id: c.chapterId,
        attributes: { chapter: c.number, title: c.title || undefined },
      }));
    }
  } catch {
    // Chapter AJAX failed — metadata still available
  }

  return {
    title: detail.title,
    description: detail.description,
    image: detail.poster,
    cover: detail.poster,
    genres: detail.genres,
    rating: detail.rating ? parseFloat(detail.rating) : undefined,
    status: detail.status,
    type: detail.type,
    chapters,
  };
}

async function fetchAsuraScanInfo(slug: string) {
  const series = await getAsuraScanSeries(slug);
  if (!series) throw new Error(`AsuraScan not found: ${slug}`);
  return {
    title: series.title,
    description: series.description || "",
    image: series.cover || "",
    cover: series.cover || "",
    genres: series.genres,
    rating: series.rating,
    status: series.status,
    type: "Manhwa",
    chapters: series.chapters.map((ch) => ({
      id: ch.id,
      attributes: { chapter: String(ch.number), title: ch.title || undefined },
    })),
  };
}

async function fetchConsumetMangaInfo(mangaId: string, provider = "mangakakalot") {
  const base = process.env.CONSUMET_BASE_URL;
  if (!base) throw new Error("CONSUMET_BASE_URL not set");
  const res = await fetch(`${base}/manga/${provider}/info?id=${encodeURIComponent(mangaId)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  const result = await res.json();
  return {
    title: result.title || result.id,
    description: result.description || "",
    image: result.image || result.cover || "",
    cover: result.cover || result.image || "",
    genres: result.genres || [],
    rating: result.rating,
    status: result.status,
    type: "Manga",
    chapters: (result.chapters || []).map((ch: any) => ({
      id: ch.id,
      attributes: {
        chapter: ch.chapter || ch.attributes?.chapter || String(ch.number || ""),
        title: ch.title || ch.attributes?.title,
      },
    })),
  };
}

export const Route = createFileRoute("/api/manga/info/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { slug } = params;
        const url = new URL(request.url);
        const source = url.searchParams.get("source") || "mangafire";

        try {
          let result;
          if (source === "asurascan") {
            result = await fetchAsuraScanInfo(slug);
          } else if (source.startsWith("consumet-")) {
            const provider = source.slice(9);
            result = await fetchConsumetMangaInfo(slug, provider);
          } else {
            result = await fetchMangaFireInfo(slug);
          }

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=120, s-maxage=300",
            },
          });
        } catch (e) {
          // If MangaFire fails, try AsuraScan then Consumet as fallback
          if (source === "mangafire") {
            try {
              const result = await fetchAsuraScanInfo(slug);
              return new Response(JSON.stringify(result), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "public, max-age=120, s-maxage=300",
                },
              });
            } catch {
              try {
                const result = await fetchConsumetMangaInfo(slug);
                return new Response(JSON.stringify(result), {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=120, s-maxage=300",
                  },
                });
              } catch {
                // Consumet also failed, fall through
              }
            }
          }

          return new Response(JSON.stringify({ error: String(e), chapters: [] }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
