import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Globe, ArrowRight, RefreshCw, Shield, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/proxy")({
  head: () => ({ meta: [{ title: "Browser — Kyrox" }] }),
  component: ProxyPage,
});

const SHORTCUTS = [
  { label: "Google", url: "https://www.google.com" },
  { label: "Wikipedia", url: "https://en.wikipedia.org" },
  { label: "DuckDuckGo", url: "https://duckduckgo.com" },
  { label: "Reddit", url: "https://www.reddit.com" },
  { label: "Hacker News", url: "https://news.ycombinator.com" },
];

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  // Looks like a domain/URL? Otherwise treat as a search query.
  const looksLikeUrl = /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+/.test(v);
  if (!looksLikeUrl) {
    return "https://duckduckgo.com/?q=" + encodeURIComponent(v);
  }
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

function ProxyPage() {
  const [address, setAddress] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function go(raw: string) {
    const url = normalizeUrl(raw);
    if (!url) return;
    setCurrent(url);
    setAddress(url);
    setSrc("/api/proxy?url=" + encodeURIComponent(url));
  }

  function reload() {
    if (iframeRef.current && src) {
      // Bust by re-setting the src.
      const s = src;
      iframeRef.current.src = "about:blank";
      requestAnimationFrame(() => {
        if (iframeRef.current) iframeRef.current.src = s;
      });
    }
  }

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-7rem)]"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-1 flex items-center gap-2">
            <Globe className="size-7 text-brand" /> Browser
          </h1>
          <p className="text-slate-400 text-sm flex items-center gap-1.5">
            <Shield className="size-3.5 text-emerald-400" /> Traffic routed through a secure relay.
          </p>
        </motion.div>

        {/* Address bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(address);
          }}
          className="flex items-center gap-2 mb-4"
        >
          {src && (
            <button
              type="button"
              onClick={reload}
              className="size-11 shrink-0 grid place-items-center rounded-2xl glass text-slate-300 hover:text-white"
              title="Reload"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter a URL or search…"
              spellCheck={false}
              className="w-full bg-surface/60 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600"
            />
          </div>
          <button
            type="submit"
            className="size-11 shrink-0 grid place-items-center rounded-2xl bg-brand text-white brand-glow hover:scale-105 transition-transform"
            title="Go"
          >
            <ArrowRight className="size-5" />
          </button>
          {current && (
            <a
              href={current}
              target="_blank"
              rel="noreferrer"
              className="size-11 shrink-0 grid place-items-center rounded-2xl glass text-slate-300 hover:text-white"
              title="Open original in new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </form>

        {/* Viewport */}
        <div className="flex-1 rounded-3xl overflow-hidden border border-white/10 bg-white">
          {src ? (
            <iframe
              ref={iframeRef}
              src={src}
              title="Proxy viewport"
              className="w-full h-full bg-white"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-pointer-lock"
            />
          ) : (
            <div className="w-full h-full bg-bg-secondary grid place-items-center p-6">
              <div className="text-center max-w-md">
                <Globe className="size-12 text-brand/60 mx-auto mb-4" />
                <h2 className="text-white font-semibold text-lg mb-1">Browse privately</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Type a URL above or jump to a shortcut. Pages load through a secure relay.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SHORTCUTS.map((s) => (
                    <button
                      key={s.url}
                      onClick={() => go(s.url)}
                      className="px-4 py-2 rounded-xl text-sm font-medium glass text-slate-200 hover:text-white"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-600 text-center mt-2">
          Some sites with heavy scripting or anti-bot protection may not fully load.
        </p>
      </motion.div>
    </AppShell>
  );
}
