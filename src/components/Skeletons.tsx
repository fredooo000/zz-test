import { motion } from "framer-motion";

export function PosterSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="animate-pulse"
    >
      <div className="aspect-[3/4] rounded-xl sm:rounded-2xl skeleton-shimmer mb-2 sm:mb-3" />
      <div className="h-3 w-3/4 bg-surface rounded skeleton-shimmer mb-1.5 sm:mb-2" />
      <div className="h-2 w-1/2 bg-surface rounded skeleton-shimmer" />
    </motion.div>
  );
}

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}

export function RailSkeleton() {
  return (
    <div className="flex gap-5 overflow-hidden pb-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="w-40 sm:w-44 lg:w-48 shrink-0">
          <PosterSkeleton />
        </div>
      ))}
    </div>
  );
}

export function SpotlightSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-10 sm:mb-14 aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] rounded-xl sm:rounded-3xl skeleton-shimmer"
    />
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-24 bg-surface rounded skeleton-shimmer" />
      <div className="h-64 sm:h-96 bg-surface rounded-2xl skeleton-shimmer" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-surface rounded skeleton-shimmer" />
        <div className="h-4 w-1/2 bg-surface rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
