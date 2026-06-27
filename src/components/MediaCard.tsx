import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { MediaItem } from "@/lib/catalog";
import { SmartImage } from "@/components/SmartImage";
import { Heart, BookmarkPlus, BookmarkCheck, Star } from "lucide-react";
import { useIsFavorite, useIsWatchlist, useLibraryActions } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function ActionButton({
  icon: Icon,
  active,
  loading,
  onClick,
  label,
  activeColor,
}: {
  icon: typeof Heart;
  active: boolean;
  loading?: boolean;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  activeColor: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.1 }}
      aria-label={label}
      className={cn(
        "size-9 rounded-full grid place-items-center backdrop-blur-md border transition-all duration-200",
        active
          ? `${activeColor} border-white/20 shadow-lg`
          : "bg-black/50 border-white/10 opacity-0 group-hover:opacity-100 hover:bg-white/20",
      )}
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        <Icon
          className={cn(
            "size-4 transition-all duration-200",
            active ? "fill-current scale-110" : "text-white",
          )}
        />
      )}
    </motion.button>
  );
}

export function MediaCard({ item, index = 0 }: { item: MediaItem; index?: number }) {
  const { user } = useAuth();
  const isFav = useIsFavorite(item.id);
  const inWatch = useIsWatchlist(item.id);
  const { handleToggle } = useLibraryActions();
  const [favLoading, setFavLoading] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const linkProps =
    item.kind === "tv"
      ? ({ to: "/tv/$id", params: { id: item.id.replace(/^tv:/, "") } } as const)
      : ({ to: "/title/$id", params: { id: item.id } } as const);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    setFavLoading(true);
    handleToggle(item, "favorite");
    setTimeout(() => setFavLoading(false), 300);
  };

  const handleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    setWatchLoading(true);
    handleToggle(item, "watchlist");
    setTimeout(() => setWatchLoading(false), 300);
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: (index % 12) * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Link {...linkProps} className="group block active:scale-[0.97] transition-transform">
        <div className="relative aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden mb-2 sm:mb-3 bg-surface border border-white/5 transition-all duration-300 group-hover:border-brand/40 group-hover:shadow-2xl group-hover:shadow-brand/10 group-hover:scale-[1.02]">
          <SmartImage
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {item.badge && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-bold text-white border border-white/10">
              {item.badge}
            </div>
          )}
          {item.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold text-amber-400">
              <Star className="size-3 fill-amber-400" /> {item.rating}
            </div>
          )}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <ActionButton
              icon={Heart}
              active={isFav}
              loading={favLoading}
              onClick={handleFav}
              label="Toggle favorite"
              activeColor="bg-red-500/80 text-white"
            />
            <ActionButton
              icon={inWatch ? BookmarkCheck : BookmarkPlus}
              active={inWatch}
              loading={watchLoading}
              onClick={handleWatch}
              label="Toggle watchlist"
              activeColor="bg-brand/80 text-white"
            />
          </div>
          {item.year && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-md text-[9px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.year}
            </div>
          )}
        </div>
        <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-brand transition-colors duration-200 line-clamp-1">
          {item.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 capitalize truncate flex items-center gap-1">
          <span className="inline-block size-1 rounded-full bg-slate-600" />
          {item.kind}
          {item.genre && <><span className="text-slate-600">&bull;</span>{item.genre}</>}
        </p>
      </Link>
    </motion.div>
  );
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  return (
    <motion.div
      layout
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5"
    >
      {items.map((m, idx) => (
        <motion.div key={m.id} layout>
          <MediaCard key={m.id} item={m} index={idx} />
        </motion.div>
      ))}
    </motion.div>
  );
}
