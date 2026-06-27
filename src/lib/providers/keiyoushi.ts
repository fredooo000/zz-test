import axios from "axios";

const INDEX_URL = "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json";

export interface KeiyoushiSource {
  name: string;
  pkg: string;
  apk: string;
  lang: string;
  code: number;
  version: string;
  nsfw: number;
  sources: { name: string; lang: string; id: string; baseUrl: string }[];
}

let cachedSources: KeiyoushiSource[] | null = null;

export async function getKeiyoushiSources(): Promise<KeiyoushiSource[]> {
  if (cachedSources) return cachedSources;
  try {
    const res = await axios.get<KeiyoushiSource[]>(INDEX_URL);
    cachedSources = res.data;
    return cachedSources;
  } catch (err) {
    console.warn("Failed to fetch keiyoushi index:", (err as Error).message);
    return [];
  }
}

export function getEnglishSources(sources: KeiyoushiSource[]) {
  return sources.filter((s) => (s.lang === "en" || s.lang === "all") && !s.nsfw);
}

export function getMangaSources(sources: KeiyoushiSource[]) {
  return getEnglishSources(sources).filter(
    (s) =>
      s.sources.some(
        (src) =>
          src.baseUrl.includes("manga") ||
          src.baseUrl.includes("dex") ||
          src.baseUrl.includes("toon") ||
          src.baseUrl.includes("webtoon"),
      ) || s.name.toLowerCase().includes("manga"),
  );
}
