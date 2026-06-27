import { Link } from "@tanstack/react-router";
import { Play, Heart, BookmarkPlus, BookmarkCheck, Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpotlight } from "@/hooks/useCatalog";
import { SpotlightSkeleton } from "./Skeletons";
import { useIsWatchlist, useIsFavorite, useLibraryActions } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function Spotlight() {
  const { data: items, isLoading } = useSpotlight();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const touchRef = useRef({ startX: 0, startY: 0 });
  const { user } = useAuth();
  const { handleToggle } = useLibraryActions();

  useEffect(() => {
    if (!items?.length) return;
    const t = setInterval(() => {
      setDir(1);
      setI((x) => (x + 1) % items.length);
    }, 6500);
    return () => clearInterval(t);
  }, [items?.length]);

  const goTo = (idx: number) => {
    setDir(idx > i ? 1 : -1);
    setI(idx);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goTo((i + 1) % items!.length);
      else goTo((i - 1 + items!.length) % items!.length);
    }
  };

  if (isLoading || !items?.length) return <SpotlightSkeleton />;
  const item = items[i % items.length];
  const isFav = useIsFavorite(item.id);
  const inWatch = useIsWatchlist(item.id);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    handleToggle(item, "watchlist");
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    handleToggle(item, "favorite");
  };

  return (
    <section className="mb-10 sm:mb-14">
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] rounded-xl sm:rounded-3xl overflow-hidden border border-white/5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.img
            key={item.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -100 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            src={item.hero ?? item.image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/10 to-transparent" />
        <div className="absolute bottom-4 left-4 sm:bottom-12 sm:left-12 right-4 sm:right-auto max-w-2xl">
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <span className="px-2.5 py-0.5 bg-brand text-white text-[10px] font-bold rounded uppercase tracking-widest shadow-lg shadow-brand/30">
              Trending
            </span>
            <span className="text-slate-300 text-xs sm:text-sm capitalize">
              {item.kind} &bull; {item.genre}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-4xl lg:text-6xl font-extrabold text-white mb-2 sm:mb-4 leading-[1.1] sm:leading-[0.95]">
            {item.title}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm lg:text-base line-clamp-2 sm:line-clamp-3 mb-3 sm:mb-6 max-w-xl">
            {item.synopsis}
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              {...(item.kind === "tv"
                ? ({ to: "/tv/$id", params: { id: item.id.replace(/^tv:/, "") } } as const)
                : ({ to: "/title/$id", params: { id: item.id } } as const))}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-black font-bold rounded-xl hover:scale-105 active:scale-[0.97] transition-transform flex items-center gap-2 text-xs sm:text-base shadow-lg"
            >
              <Play className="size-3.5 sm:size-4 fill-current" /> Watch Now
            </Link>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleWishlist}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm shadow-lg ${
                inWatch
                  ? "bg-brand text-white"
                  : "glass text-white hover:bg-white/10"
              }`}
            >
              {inWatch ? <BookmarkCheck className="size-3.5 sm:size-4" /> : <BookmarkPlus className="size-3.5 sm:size-4" />}
              {inWatch ? "In Watchlist" : "Wishlist"}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleFavorite}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm shadow-lg ${
                isFav ? "bg-red-500/90 text-white" : "glass text-white hover:bg-white/10"
              }`}
              aria-label="Toggle favorite"
            >
              <Heart className={`size-3.5 sm:size-4 ${isFav ? "fill-current" : ""}`} />
            </motion.button>
          </div>
        </div>
        <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 flex gap-1.5">
          {items.slice(0, 5).map((_: unknown, idx: number) => (
            <motion.button
              key={idx}
              onClick={() => goTo(idx)}
              className="h-2 sm:h-1.5 rounded-full transition-all duration-300"
              whileTap={{ scale: 1.5 }}
              style={{
                width: idx === i % items.length ? "2rem" : "0.75rem",
                background: idx === i % items.length ? "var(--brand)" : "rgba(255,255,255,0.3)",
              }}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
