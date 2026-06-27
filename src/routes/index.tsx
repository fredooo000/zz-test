import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Spotlight } from "@/components/Spotlight";
import { Rail } from "@/components/Rail";
import { TvRail, MovieRail } from "@/components/CategoryRail";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kyrox — Anime, TV, Movies, Manga & Manhwa" },
      {
        name: "description",
        content: "Stream anime, TV shows & films, read manga & manhwa. All in one cinematic hub.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Spotlight />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <TvRail title="Trending TV Shows" category="trending" viewAll="/tv" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <MovieRail title="Trending Movies" category="trending" viewAll="/movies" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Rail title="Popular Anime" kind="anime" viewAll="/anime" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Rail title="Popular Manhwa" kind="manhwa" viewAll="/manhwa" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Rail title="Latest Manga" kind="manga" viewAll="/manga" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <Rail title="Featured Films" kind="movie" viewAll="/movies" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Rail title="Top TV Series" kind="tv" viewAll="/tv" />
      </motion.div>
    </AppShell>
  );
}
