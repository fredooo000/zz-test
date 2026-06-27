import { Link } from "@tanstack/react-router";
import type { MediaItem, MediaKind } from "@/lib/catalog";
import { MediaCard } from "./MediaCard";
import { useCatalog } from "@/hooks/useCatalog";
import { RailSkeleton } from "./Skeletons";
import { useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export function Rail({
  title,
  kind,
  viewAll,
  items: explicit,
}: {
  title: string;
  kind?: MediaKind;
  viewAll?: string;
  items?: MediaItem[];
}) {
  const q = useCatalog(kind ?? "anime");
  const catalogItems = useMemo(() => q.data?.pages[0]?.items ?? [], [q.data]);
  const items = explicit ?? (kind ? catalogItems : []);
  const loading = !explicit && kind && q.isLoading && !items.length;
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
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
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
      {loading ? (
        <RailSkeleton />
      ) : (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 sm:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 snap-x scroll-smooth"
        >
          {items.map((m, idx) => (
            <div key={m.id} className="w-32 sm:w-40 lg:w-48 shrink-0 snap-start">
              <MediaCard item={m} index={idx} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
