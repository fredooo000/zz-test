import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Play,
  Subtitles,
  Globe,
  Volume2,
  ArrowLeft,
  Bell,
  Shield,
  Languages,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { applyTheme as applyThemeClass } from "@/lib/settings";

type PlayerQuality = "auto" | "1080p" | "720p" | "480p";
type SubtitlePref = "off" | "on" | "english-only";
type DefaultLang = "sub" | "dub";
type InterfaceLang = "en" | "ja" | "ko" | "es" | "fr";
type PlayerSettings = {
  quality: PlayerQuality;
  subtitlePref: SubtitlePref;
  defaultLang: DefaultLang;
  autoPlay: boolean;
  autoNext: boolean;
  interfaceLang: InterfaceLang;
  explicitFilter: boolean;
  autoplayTrailers: boolean;
  reduceMotion: boolean;
  showProgressBar: boolean;
};

const defaultSettings: PlayerSettings = {
  quality: "auto",
  subtitlePref: "on",
  defaultLang: "sub",
  autoPlay: true,
  autoNext: true,
  interfaceLang: "en",
  explicitFilter: true,
  autoplayTrailers: true,
  reduceMotion: false,
  showProgressBar: true,
};

function loadSettings(): PlayerSettings {
  try {
    const s = JSON.parse(localStorage.getItem("haven-settings") || "{}");
    return { ...defaultSettings, ...s };
  } catch {
    return { ...defaultSettings };
  }
}

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Kyrox" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [settings, setSettings] = useState<PlayerSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    applyThemeClass(t);
  };

  const set = <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    localStorage.setItem("haven-settings", JSON.stringify({ ...settings, theme }));
    setSaved(true);
    window.dispatchEvent(new Event("kyrox-settings-changed"));
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    applyThemeClass(theme);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (settings.reduceMotion) {
      html.style.setProperty("--reduce-motion", "reduce");
      html.classList.add("reduce-motion");
    } else {
      html.style.removeProperty("--reduce-motion");
      html.classList.remove("reduce-motion");
    }
  }, [settings.reduceMotion]);

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-brand peer-focus:ring-2 peer-focus:ring-brand/30 transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[19px]" />
    </label>
  );

  return (
    <AppShell>
      <Link
        to="/account"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Settings className="size-6 text-brand" />
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Settings</h1>
      </div>
      <p className="text-slate-400 mb-8 text-sm sm:text-base">Customize your Kyrox experience.</p>

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Appearance
          </h2>
          <div className="bg-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  {theme === "dark" ? (
                    <Moon className="size-4 text-purple-400" />
                  ) : theme === "light" ? (
                    <Sun className="size-4 text-amber-400" />
                  ) : (
                    <Monitor className="size-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Theme</p>
                  <p className="text-xs text-slate-500">Dark / Light / System</p>
                </div>
              </div>
              <select
                value={theme}
                onChange={(e) => applyTheme(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand/50"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Eye className="size-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Reduce motion</p>
                  <p className="text-xs text-slate-500">Minimize animations and transitions</p>
                </div>
              </div>
              <Toggle
                checked={settings.reduceMotion}
                onChange={() => set("reduceMotion", !settings.reduceMotion)}
              />
            </div>
          </div>
        </section>

        {/* Interface */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Interface
          </h2>
          <div className="bg-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Languages className="size-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Language</p>
                  <p className="text-xs text-slate-500">Interface language</p>
                </div>
              </div>
              <select
                value={settings.interfaceLang}
                onChange={(e) => set("interfaceLang", e.target.value as InterfaceLang)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand/50"
              >
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Shield className="size-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Explicit content filter</p>
                  <p className="text-xs text-slate-500">Hide mature-rated titles</p>
                </div>
              </div>
              <Toggle
                checked={settings.explicitFilter}
                onChange={() => set("explicitFilter", !settings.explicitFilter)}
              />
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Bell className="size-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Autoplay trailers</p>
                  <p className="text-xs text-slate-500">Play trailers on title hover</p>
                </div>
              </div>
              <Toggle
                checked={settings.autoplayTrailers}
                onChange={() => set("autoplayTrailers", !settings.autoplayTrailers)}
              />
            </div>
          </div>
        </section>

        {/* Playback */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Playback
          </h2>
          <div className="bg-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Play className="size-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Auto-play next episode</p>
                  <p className="text-xs text-slate-500">Automatically start the next episode</p>
                </div>
              </div>
              <Toggle
                checked={settings.autoPlay}
                onChange={() => set("autoPlay", !settings.autoPlay)}
              />
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Play className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Auto-next on complete</p>
                  <p className="text-xs text-slate-500">Skip to next when episode ends</p>
                </div>
              </div>
              <Toggle
                checked={settings.autoNext}
                onChange={() => set("autoNext", !settings.autoNext)}
              />
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Globe className="size-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Default language</p>
                  <p className="text-xs text-slate-500">Subbed or Dubbed</p>
                </div>
              </div>
              <select
                value={settings.defaultLang}
                onChange={(e) => set("defaultLang", e.target.value as DefaultLang)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand/50"
              >
                <option value="sub">Subbed</option>
                <option value="dub">Dubbed</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Subtitles className="size-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Subtitles</p>
                  <p className="text-xs text-slate-500">Default subtitle behavior</p>
                </div>
              </div>
              <select
                value={settings.subtitlePref}
                onChange={(e) => set("subtitlePref", e.target.value as SubtitlePref)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand/50"
              >
                <option value="on">Always on</option>
                <option value="off">Always off</option>
                <option value="english-only">English only</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Volume2 className="size-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Stream quality</p>
                  <p className="text-xs text-slate-500">Preferred video quality</p>
                </div>
              </div>
              <select
                value={settings.quality}
                onChange={(e) => set("quality", e.target.value as PlayerQuality)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand/50"
              >
                <option value="auto">Auto</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Play className="size-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Show progress bar</p>
                  <p className="text-xs text-slate-500">Episode/chapter progress indicator</p>
                </div>
              </div>
              <Toggle
                checked={settings.showProgressBar}
                onChange={() => set("showProgressBar", !settings.showProgressBar)}
              />
            </div>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Data
          </h2>
          <div className="bg-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Trash2 className="size-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Clear local data</p>
                  <p className="text-xs text-slate-500">Reset settings, cache, and preferences</p>
                </div>
              </div>
              {clearConfirm ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.clear();
                      setClearConfirm(false);
                      setSettings({ ...defaultSettings });
                    }}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearConfirm(false)}
                    className="px-3 py-1.5 bg-white/5 text-slate-300 text-xs rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs rounded-lg hover:bg-white/10 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={save}
          className="w-full max-w-2xl py-3 bg-brand text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all"
        >
          {saved ? "Saved ✓" : "Save Preferences"}
        </button>
      </div>
    </AppShell>
  );
}
