import { useEffect, useRef, useState } from "react";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 600'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#1e1e26'/><stop offset='1' stop-color='#0b0b12'/>
      </linearGradient></defs>
      <rect width='400' height='600' fill='url(#g)'/>
    </svg>`,
  );

function buildChain(src?: string): string[] {
  const chain: string[] = [];
  if (src) {
    chain.push(src);
    const proxyMatch = src.match(/\/api\/public\/mangadex-image\/(.+)$/);
    if (proxyMatch) chain.push(`https://uploads.mangadex.org/${proxyMatch[1]}`);
    const directMatch = src.match(/^https?:\/\/uploads\.mangadex\.org\/(.+)$/);
    if (directMatch) chain.unshift(`/api/public/mangadex-image/${directMatch[1]}`);
  }
  chain.push(PLACEHOLDER);
  return Array.from(new Set(chain));
}

function preloadImage(url: string) {
  if (typeof window === "undefined" || !url || url === PLACEHOLDER) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.fetchPriority = "high";
  document.head.appendChild(link);
  setTimeout(() => link.remove(), 5000);
}

export function SmartImage({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src?: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [chain, setChain] = useState(() => buildChain(src));
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setChain(buildChain(src));
    setIdx(0);
    setLoaded(false);
    if (loading === "eager" && src) {
      preloadImage(src);
    }
  }, [src, loading]);

  return (
    <div className="relative overflow-hidden bg-surface/50">
      <img
        ref={imgRef}
        src={chain[idx] || PLACEHOLDER}
        alt={alt ?? ""}
        loading={loading}
        decoding="async"
        fetchPriority={loading === "eager" ? "high" : "low"}
        onError={() => setIdx((i) => Math.min(i + 1, chain.length - 1))}
        onLoad={() => setLoaded(true)}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: idx === 0 ? "none" : undefined }}
      />
    </div>
  );
}

export const IMAGE_PLACEHOLDER = PLACEHOLDER;
