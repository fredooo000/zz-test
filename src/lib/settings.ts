import type { MediaItem } from "@/lib/catalog";

// ─── Client settings access ───────────────────────────────────────────────────
// Settings are persisted by the Settings page under the "haven-settings" key.
// These helpers read them safely from anywhere on the client (no-op on server).

const SETTINGS_KEY = "haven-settings";

export function getSettings(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

// Whether mature/adult titles should be hidden. Defaults to ON (hidden) so
// explicit content never shows unless the user explicitly disables the filter.
export function isExplicitFilterOn(): boolean {
  const s = getSettings();
  return s.explicitFilter === undefined ? true : Boolean(s.explicitFilter);
}

// Genre/tag keywords that mark a title as adult/NSFW.
const ADULT_KEYWORDS = [
  "adult",
  "mature",
  "ecchi",
  "hentai",
  "smut",
  "erotic",
  "erotica",
  "18+",
  "+18",
  "r18",
  "r-18",
  "nsfw",
  "pornographic",
  "yaoi",
  "yuri",
];

export function isAdultText(...parts: (string | undefined | null)[]): boolean {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return ADULT_KEYWORDS.some((k) => hay.includes(k));
}

// True if an item looks adult based on its explicit nsfw flag or genre text.
export function isNsfwItem(item: MediaItem & { nsfw?: boolean }): boolean {
  if (item.nsfw) return true;
  return isAdultText(item.genre, item.badge);
}

// Remove adult items when the explicit filter is enabled.
export function filterExplicit<T extends MediaItem & { nsfw?: boolean }>(items: T[]): T[] {
  if (!isExplicitFilterOn()) return items;
  return items.filter((it) => !isNsfwItem(it));
}

// ─── Theme ─────────────────────────────────────────────────────────────────
export type ThemeChoice = "dark" | "light" | "system";

// Resolve "system" to the OS preference; otherwise pass through.
export function resolveTheme(t: string): "dark" | "light" {
  if (t === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t === "light" ? "light" : "dark";
}

// Apply the chosen theme by toggling the html class. CSS keys off `.light`.
export function applyTheme(t: string): void {
  if (typeof document === "undefined") return;
  const eff = resolveTheme(t);
  const c = document.documentElement.classList;
  c.toggle("dark", eff === "dark");
  c.toggle("light", eff === "light");
}
