"use client";

import { Loader2, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const DEFAULT_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation";

interface StreamEmbedProps {
  src: string;
  title?: string;
  sandbox?: string;
}

export function StreamEmbed({ src, title, sandbox }: StreamEmbedProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stalled, setStalled] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const retryKey = useRef(0);

  useEffect(() => {
    setError(false);
    setLoading(true);
    setStalled(false);
    retryKey.current += 1;
  }, [src]);

  useEffect(() => {
    if (!loading || error) return;
    const timer = setTimeout(() => setStalled(true), 10000);
    return () => clearTimeout(timer);
  }, [loading, error]);

  return (
    <div className="w-full">
      <div className="relative rounded-2xl overflow-hidden bg-black border border-white/5 shadow-2xl mb-3">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-brand" />
              <p className="text-sm text-slate-500">Loading player...</p>
              {stalled && (
                <div className="flex items-center gap-2 text-xs text-amber-400 mt-1">
                  <Clock className="size-3.5" />
                  Source is slow — still trying...
                </div>
              )}
            </div>
          </div>
        )}
        {error ? (
          <div className="w-full min-h-[70vh] sm:min-h-[75vh] flex flex-col items-center justify-center gap-4 p-8">
            <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="size-8 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">Failed to load stream</p>
              <p className="text-xs text-slate-500 mt-1">
                The source may be unavailable or blocked
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(false);
                setLoading(true);
                retryKey.current += 1;
              }}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all"
            >
              <RefreshCw className="size-4" />
              Retry
            </button>
          </div>
        ) : sandbox === "" ? (
          <iframe
            key={retryKey.current}
            ref={iframeRef}
            src={src}
            title={title || "Stream"}
            className="w-full min-h-[70vh] sm:min-h-[75vh]"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write"
            onLoad={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
          />
        ) : (
          <iframe
            key={retryKey.current}
            ref={iframeRef}
            src={src}
            title={title || "Stream"}
            className="w-full min-h-[70vh] sm:min-h-[75vh]"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox={sandbox ?? DEFAULT_SANDBOX}
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write"
            onLoad={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
          />
        )}
      </div>
      {error && (
        <div className="flex items-center justify-end">
          <span className="text-xs text-red-400">Stream error — source may be down</span>
        </div>
      )}
    </div>
  );
}

export function StreamEmbedSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-black border border-white/5 shadow-2xl mb-3">
      <div className="w-full min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center bg-surface/50">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    </div>
  );
}
