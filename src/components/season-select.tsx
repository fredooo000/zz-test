/**
 * SeasonSelect — season picker for TV detail pages in Kyrox.
 *
 * USAGE IN YOUR TV DETAIL PAGE (routes/tv.$id.tsx or title.$id.tsx):
 *
 *   import { SeasonSelect } from "@/components/season-select";
 *
 *   // In your component:
 *   const [selectedSeason, setSelectedSeason] = useState(1);
 *
 *   <SeasonSelect
 *     seasons={tvData.seasons}          // Season[]
 *     selectedSeason={selectedSeason}
 *     onChange={setSelectedSeason}
 *   />
 *
 * The page title should always be the BASE title (no "Season X" suffix).
 * The season picker handles that context.
 *
 * ─── Data shape ───────────────────────────────────────────────────────────────
 * Your TMDB/Consumet API response almost certainly returns something like:
 *
 *   {
 *     name: "Re:ZERO -Starting Life in Another World-",
 *     seasons: [
 *       { season_number: 1, name: "Season 1", episode_count: 13, air_date: "2016-01-01" },
 *       { season_number: 2, name: "Season 2", episode_count: 13, air_date: "2020-07-01" },
 *       { season_number: 3, name: "Season 3", episode_count: 12, air_date: "2024-10-01" },
 *       { season_number: 4, name: "Season 4", episode_count: 13, air_date: "2025-04-01" },
 *     ]
 *   }
 *
 * Pass `seasons` directly. SeasonSelect normalises display names internally.
 */

import { useState, useRef, useEffect } from "react";

export interface Season {
  season_number: number;
  /** e.g. "Season 1", "Specials", "Part 2" — shown in dropdown */
  name: string;
  episode_count?: number;
  air_date?: string | null;
}

interface SeasonSelectProps {
  seasons: Season[];
  selectedSeason: number;
  onChange: (seasonNumber: number) => void;
  /** Optional: show episode count alongside season name */
  showEpisodeCount?: boolean;
  className?: string;
}

export function SeasonSelect({
  seasons,
  selectedSeason,
  onChange,
  showEpisodeCount = true,
  className = "",
}: SeasonSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Filter out "Season 0" (specials) — move it to the end if present
  const mainSeasons = seasons.filter((s) => s.season_number > 0);
  const specials = seasons.filter((s) => s.season_number === 0);
  const ordered = [...mainSeasons, ...specials];

  const current = ordered.find((s) => s.season_number === selectedSeason) ?? ordered[0];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!ordered.length) return null;
  // Single season — no picker needed, just show "Season 1" as plain text
  if (ordered.length === 1) {
    return (
      <span className={`text-sm text-[var(--color-muted-foreground)] ${className}`}>
        {ordered[0].name}
        {showEpisodeCount && ordered[0].episode_count != null
          ? ` · ${ordered[0].episode_count} episodes`
          : ""}
      </span>
    );
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-foreground)] hover:border-[var(--color-brand)]",
          "transition-colors duration-150 cursor-pointer select-none",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-1",
          "focus:ring-offset-[var(--color-background)]",
        ].join(" ")}
      >
        <span>{current?.name ?? "Season"}</span>
        {showEpisodeCount && current?.episode_count != null && (
          <span className="text-[var(--color-muted-foreground)] font-normal">
            · {current.episode_count} ep
          </span>
        )}
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`ml-0.5 shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          aria-label="Select season"
          className={[
            "absolute z-50 mt-1 min-w-[180px] max-h-64 overflow-y-auto",
            "rounded-md border border-[var(--color-border)]",
            "bg-[var(--color-popover)] shadow-xl",
            "py-1 no-scrollbar",
          ].join(" ")}
        >
          {ordered.map((season) => {
            const isSelected = season.season_number === selectedSeason;
            return (
              <li
                key={season.season_number}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(season.season_number);
                  setOpen(false);
                }}
                className={[
                  "flex items-center justify-between gap-4 px-3 py-2",
                  "text-sm cursor-pointer transition-colors duration-100",
                  isSelected
                    ? "text-[var(--color-brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]"
                    : "text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]",
                ].join(" ")}
              >
                <span>{season.name}</span>
                {showEpisodeCount && season.episode_count != null && (
                  <span className="text-[var(--color-muted-foreground)] tabular-nums shrink-0">
                    {season.episode_count} ep
                  </span>
                )}
                {isSelected && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0 text-[var(--color-brand)]"
                  >
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── useTvDetail hook ─────────────────────────────────────────────────────────
// Drop this in your TV detail route. It handles:
//   - fetching show data (base title + all seasons)
//   - season state
//   - fetching episodes for the selected season
//
// This avoids separate routes per season (which was causing the "Season 4"
// baked-in-title problem). One route: /tv/$id — season is UI state, not a URL param.
//
// If you want the season in the URL as a search param (?season=2) so links are
// shareable, use `useSearch` and `useNavigate` from TanStack Router instead of
// useState. Example:
//
//   const { season } = useSearch({ from: '/tv/$id' })
//   const navigate = useNavigate()
//   const selectedSeason = season ?? 1
//   const setSelectedSeason = (n: number) => navigate({ search: { season: n } })
//
import { useQuery } from "@tanstack/react-query";

interface TvDetailOptions {
  /** TMDB show ID */
  id: string;
  initialSeason?: number;
}

interface TmdbSeason {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

interface TmdbShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  seasons: TmdbSeason[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  status: string;
}

// Adjust these fetch functions to use your actual proxy endpoints.
// Your proxy routes are: /api/public/tmdb/$ and /api/public/consumet/$
async function fetchTvShow(id: string): Promise<TmdbShow> {
  const res = await fetch(`/api/public/tmdb/tv/${id}`);
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`);
  return res.json();
}

async function fetchSeasonEpisodes(showId: string, seasonNumber: number) {
  const res = await fetch(`/api/public/tmdb/tv/${showId}/season/${seasonNumber}`);
  if (!res.ok) throw new Error(`Season fetch failed: ${res.status}`);
  return res.json();
}

export function useTvDetail({ id, initialSeason = 1 }: TvDetailOptions) {
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);

  const showQuery = useQuery({
    queryKey: ["tv", "show", id],
    queryFn: () => fetchTvShow(id),
    // Show metadata is stable — 5 min stale time is fine here.
    staleTime: 5 * 60_000,
  });

  const seasonQuery = useQuery({
    queryKey: ["tv", "season", id, selectedSeason],
    queryFn: () => fetchSeasonEpisodes(id, selectedSeason),
    // Episodes may update (new episodes airing) — 2 min stale so it stays fresh.
    staleTime: 2 * 60_000,
    // Don't fetch season until we have the show data
    enabled: showQuery.isSuccess,
  });

  return {
    show: showQuery.data,
    showLoading: showQuery.isLoading,
    showError: showQuery.error,
    seasons: showQuery.data?.seasons ?? [],
    selectedSeason,
    setSelectedSeason,
    episodes: (seasonQuery.data as any)?.episodes ?? [],
    episodesLoading: seasonQuery.isLoading,
    episodesError: seasonQuery.error,
  };
}

// ─── Example TV detail page ───────────────────────────────────────────────────
// Drop this pattern into routes/tv.$id.tsx
//
// import { useParams } from "@tanstack/react-router";
// import { SeasonSelect, useTvDetail } from "@/components/season-select";
//
// export default function TvDetailPage() {
//   const { id } = useParams({ from: '/tv/$id' });
//   const {
//     show,
//     showLoading,
//     seasons,
//     selectedSeason,
//     setSelectedSeason,
//     episodes,
//     episodesLoading,
//   } = useTvDetail({ id });
//
//   if (showLoading) return <LoadingSpinner />;
//   if (!show) return null;
//
//   return (
//     <div>
//       {/* Base title — NO "Season X" suffix */}
//       <h1>{show.name}</h1>
//
//       {/* Season picker sits under the title */}
//       <SeasonSelect
//         seasons={seasons}
//         selectedSeason={selectedSeason}
//         onChange={setSelectedSeason}
//       />
//
//       {/* Episodes for the selected season */}
//       {episodesLoading ? (
//         <LoadingSpinner />
//       ) : (
//         <EpisodeList episodes={episodes} />
//       )}
//     </div>
//   );
// }
