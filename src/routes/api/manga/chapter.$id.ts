import { createFileRoute } from "@tanstack/react-router";
import { parseChapterImages } from "@/lib/scrapers/mangafire";
import { getAsuraScanPages } from "@/lib/scrapers/asurascan";

const MANGAFIRE = "https://mangafire.to";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: MANGAFIRE + "/",
  "X-Requested-With": "XMLHttpRequest",
};

async function fetchMangaFirePages(chapterId: string): Promise<string[]> {
  const res = await fetch(`${MANGAFIRE}/ajax/read/chapter/${chapterId}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Mangafire ${res.status}`);
  const json = await res.json();
  return parseChapterImages(json);
}

async function fetchAsuraScanPages(chapterId: string): Promise<string[]> {
  const pages = await getAsuraScanPages(chapterId);
  if (!pages.length) throw new Error(`AsuraScan no pages for ${chapterId}`);
  return pages;
}

async function fetchConsumetPages(chapterId: string, provider = "mangakakalot"): Promise<string[]> {
  const base = process.env.CONSUMET_BASE_URL;
  if (!base) throw new Error("CONSUMET_BASE_URL not set");
  const res = await fetch(
    `${base}/manga/${provider}/read?chapterId=${encodeURIComponent(chapterId)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data.map((p: any) => p.img || p.url || String(p));
  if (data.pages) return data.pages;
  if (Array.isArray(data.images)) return data.images;
  throw new Error("Unexpected chapter response format");
}

export const Route = createFileRoute("/api/manga/chapter/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { id } = params;
        const url = new URL(request.url);
        const source = url.searchParams.get("source") || "mangafire";

        try {
          let pages: string[];
          if (source === "asurascan") {
            pages = await fetchAsuraScanPages(id);
          } else if (source.startsWith("consumet-")) {
            const provider = source.slice(9);
            pages = await fetchConsumetPages(id, provider);
          } else {
            pages = await fetchMangaFirePages(id);
          }

          return new Response(JSON.stringify({ pages }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=300, s-maxage=600",
            },
          });
        } catch (e) {
          // Fallback: try AsuraScan then Consumet if MangaFire failed
          if (source === "mangafire") {
            try {
              const pages = await fetchAsuraScanPages(id);
              return new Response(JSON.stringify({ pages }), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "public, max-age=300, s-maxage=600",
                },
              });
            } catch {
              try {
                const pages = await fetchConsumetPages(id);
                return new Response(JSON.stringify({ pages }), {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=300, s-maxage=600",
                  },
                });
              } catch {
                // Consumet also failed, fall through to error response
              }
            }
          }

          return new Response(JSON.stringify({ error: String(e), pages: [] }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
