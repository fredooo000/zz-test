// Movies & TV — VidNest, Vidsrc, VidLink
const VIDNEST = "https://vidnest.fun";
const VIDLINK = "https://vidlink.pro";
const VIDSRC = "https://vidsrc.to/embed";
// Anime (dropfile.cc supports AniList IDs)
const ANIME_EMBED = "https://dropfile.cc";

// Internal fallback ID → AniList ID
export const ANILIST_IDS: Record<string, number> = {
  "spot-1": 142838, // Solo Leveling
  "spot-2": 154587, // Frieren
  fa1: 154587, // Frieren
  fa2: 113415, // Jujutsu Kaisen S1
  fa3: 139274, // Cyberpunk: Edgerunners
  fa4: 127230, // Chainsaw Man
  fa5: 166240, // Demon Slayer Swordsmith Village
  fa6: 140960, // Spy x Family
  fa7: 136430, // Vinland Saga
  fa8: 130003, // Bocchi the Rock
  fa9: 16498, // Attack on Titan
  fa10: 21519, // One Piece
  fa11: 5114, // FMA: Brotherhood
  fa12: 9253, // Steins;Gate
};

// Internal fallback ID → TMDB ID (movies)
export const TMDB_IDS: Record<string, number> = {
  "spot-3": 693134, // Dune Part Two
  fm1: 693134, // Dune Part Two
  fm2: 872585, // Oppenheimer
  fm3: 129, // Spirited Away
  fm4: 372058, // Your Name
  fm5: 149, // Akira
  fm6: 128, // Princess Mononoke
  fm7: 508883, // The Boy and the Heron
  fm8: 104341, // Perfect Blue
  fm9: 157336, // Interstellar
  fm10: 155, // The Dark Knight
  fm11: 27205, // Inception
  fm12: 603, // The Matrix
  // CATALOG movie IDs
  mv1: 693134, // Dune: Part Two
  mv2: 872585, // Oppenheimer
  mv3: 157336, // Interstellar
  mv4: 155, // The Dark Knight
  mv5: 27205, // Inception
  mv6: 603, // The Matrix
  mv7: 98, // Gladiator
  mv8: 496243, // Parasite
  mv9: 157336, // Interstellar
  mv10: 76341, // Mad Max: Fury Road
};

export const TV_TMDB_IDS: Record<string, number> = {
  ft1: 1396, // Breaking Bad
  ft2: 1399, // Game of Thrones
  ft3: 66732, // Stranger Things
  ft4: 100088, // The Last of Us
  ft5: 76479, // The Boys
  ft6: 70523, // Dark
  ft7: 71912, // The Witcher
  ft8: 93405, // Squid Game
  ft9: 94997, // House of the Dragon
  ft10: 60059, // Better Call Saul
  ft11: 82883, // True Detective
  ft12: 2316, // The Office
  // Fallback TV catalog IDs
  "tv-1": 1396, // Breaking Bad
  "tv-2": 1399, // Game of Thrones
  "tv-3": 66732, // Stranger Things
  "tv-4": 100088, // The Last of Us
  "tv-5": 76479, // The Boys
  "tv-6": 70523, // Dark
  "tv-7": 71912, // The Witcher
  "tv-8": 93405, // Squid Game
  "tv-9": 94997, // House of the Dragon
  "tv-10": 60059, // Better Call Saul
  "tv-11": 82883, // True Detective
  "tv-12": 2316, // The Office
};

export function animeStreamUrl(anilistId: number, episode: string, season?: string): string {
  const s = season || "1";
  return `${ANIME_EMBED}/player/tv/anilist-${anilistId}/${s}/${episode}`;
}

// VidNest
export function vidnestMovieUrl(tmdbId: number): string {
  return `${VIDNEST}/movie/${tmdbId}`;
}
export function vidnestTvUrl(tmdbId: number, season: string, episode: string): string {
  return `${VIDNEST}/tv/${tmdbId}/${season}/${episode}`;
}
export function vidnestAnimeUrl(anilistId: number, episode: string, subOrDub = "sub"): string {
  return `${VIDNEST}/anime/${anilistId}/${episode}/${subOrDub}`;
}

// Vidsrc (vidsrc.to)
export function vidsrcMovieUrl(tmdbId: number): string {
  return `${VIDSRC}/movie/${tmdbId}`;
}
export function vidsrcTvUrl(tmdbId: number, season: string, episode: string): string {
  return `${VIDSRC}/tv/${tmdbId}/${season}/${episode}`;
}

// VidLink
export function vidlinkMovieUrl(tmdbId: number): string {
  return `${VIDLINK}/movie/${tmdbId}`;
}
export function vidlinkTvUrl(tmdbId: number, season: string, episode: string): string {
  return `${VIDLINK}/tv/${tmdbId}/${season}/${episode}`;
}

// VidFast
const VIDFAST = "https://vidfast.pro";
export function vidfastMovieUrl(tmdbId: number): string {
  return `${VIDFAST}/movie/${tmdbId}?autoPlay=true`;
}
export function vidfastTvUrl(tmdbId: number, season: string, episode: string): string {
  return `${VIDFAST}/tv/${tmdbId}/${season}/${episode}?autoPlay=true`;
}

// VixSrc
const VIXSRC = "https://vixsrc.to";
export function vixsrcMovieUrl(tmdbId: number): string {
  return `${VIXSRC}/movie/${tmdbId}`;
}
export function vixsrcTvUrl(tmdbId: number, season: string, episode: string): string {
  return `${VIXSRC}/tv/${tmdbId}/${season}/${episode}`;
}
