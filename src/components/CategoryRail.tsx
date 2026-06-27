import { Link } from "@tanstack/react-router";
import { MediaCard } from "./MediaCard";
import { RailSkeleton } from "./Skeletons";
import { useAnimeCategory, useMovieCategory, useTvCategory, type AnimeCategory } from "@/hooks/useCatalog";
import type { MovieCategory, TvCategory } from "@/lib/tmdb";
import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function RailScroll({
  title,
  viewAll,
  isLoading,
  items,
  children,
}: {
  title: string;
  viewAll?: string;
  isLoading: boolean;
  items: unknown[];
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.6 : el.clientWidth * 0.6, behavior: "smooth" });
  };

  return (
    <section className="mb-10 sm:mb-12">
      <div className="flex items-end justify-between mb-4 sm:mb-5">
        <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex gap-1">
            <button
              onClick={() => scroll("left")}
              className={`size-8 rounded-xl grid place-items-center transition-all ${
                canScrollLeft ? "glass text-white hover:bg-white/10" : "opacity-20 text-slate-500"
              }`}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className={`size-8 rounded-xl grid place-items-center transition-all ${
                canScrollRight ? "glass text-white hover:bg-white/10" : "opacity-20 text-slate-500"
              }`}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {viewAll && (
            <Link to={viewAll} className="text-xs sm:text-sm text-brand font-medium hover:underline whitespace-nowrap">
              View all &rarr;
            </Link>
          )}
        </div>
      </div>
      {isLoading && !items.length ? (
        <RailSkeleton />
      ) : items.length ? (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 sm:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 snap-x scroll-smooth"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function CategoryRail({
  title,
  category,
  viewAll = "/anime",
}: {
  title: string;
  category: AnimeCategory;
  viewAll?: string;
}) {
  const { data, isLoading } = useAnimeCategory(category);
  const items = data ?? [];

  return (
    <RailScroll title={title} viewAll={viewAll} isLoading={isLoading} items={items}>
      {items.map((m, idx) => (
        <div key={m.id} className="w-32 sm:w-40 lg:w-48 shrink-0 snap-start">
          <MediaCard item={m} index={idx} />
        </div>
      ))}
    </RailScroll>
  );
}

export function TvRail({
  title,
  category,
  viewAll = "/tv",
}: {
  title: string;
  category: TvCategory;
  viewAll?: string;
}) {
  const { data, isLoading } = useTvCategory(category);
  const items = data ?? [];

  return (
    <RailScroll title={title} viewAll={viewAll} isLoading={isLoading} items={items}>
      {items.map((m, idx) => (
        <div key={m.id} className="w-32 sm:w-40 lg:w-48 shrink-0 snap-start">
          <MediaCard item={m} index={idx} />
        </div>
      ))}
    </RailScroll>
  );
}

export function MovieRail({
  title,
  category,
  viewAll = "/movies",
}: {
  title: string;
  category: MovieCategory;
  viewAll?: string;
}) {
  const { data, isLoading } = useMovieCategory(category);
  const items = data ?? [];

  return (
    <RailScroll title={title} viewAll={viewAll} isLoading={isLoading} items={items}>
      {items.map((m, idx) => (
        <div key={m.id} className="w-32 sm:w-40 lg:w-48 shrink-0 snap-start">
          <MediaCard item={m} index={idx} />
        </div>
      ))}
    </RailScroll>
  );
}
