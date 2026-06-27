import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle } from "lucide-react";

type StreamType = "auto" | "m3u8" | "mp4";
type StreamCandidate = { url: string; type?: StreamType; label?: string };

type Diagnostic = {
  level: "info" | "warn" | "error";
  message: string;
  at: number;
};

export function HlsPlayer({
  src,
  poster,
  type = "auto",
  fallbackSources = [],
}: {
  src: string;
  poster?: string;
  type?: StreamType;
  fallbackSources?: StreamCandidate[];
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [attempt, setAttempt] = useState(0); // bump to force re-init / retry

  const log = useCallback((level: Diagnostic["level"], message: string) => {
    setDiagnostics((d) => [...d.slice(-9), { level, message, at: Date.now() }]);
    if (level === "error") console.error("[HlsPlayer]", message);
    else console.log("[HlsPlayer]", message);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    let stopped = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;
    setError(null);
    setIsLoading(true);
    setDiagnostics([]);

    const candidates = [
      { url: src, type, label: type === "mp4" ? "MP4" : "HLS" },
      ...fallbackSources,
    ]
      .filter((s) => s.url)
      .filter((s, i, list) => list.findIndex((o) => o.url === s.url) === i);

    const cleanupHls = () => {
      hls?.destroy();
      hls = null;
    };

    const markReady = () => {
      if (stopped) return;
      setIsLoading(false);
      setError(null);
      if (loadingTimer) clearTimeout(loadingTimer);
    };

    const showError = (message: string) => {
      if (stopped) return;
      setIsLoading(false);
      setError(message);
      if (loadingTimer) clearTimeout(loadingTimer);
    };

      const playCandidate = (index: number, previousError?: string) => {
        const candidate = candidates[index];
        cleanupHls();
        video.removeAttribute("src");
        video.load();

        if (!candidate) {
          showError(
            previousError ||
              "All sources failed. The stream may be geo-blocked or temporarily offline.",
          );
          return;
        }

        setIsLoading(true);
        setError(null);
        setActiveLabel(candidate.label || `Source ${index + 1}`);
        log(
          "info",
          `Trying ${candidate.label || `source ${index + 1}`} (${candidate.url.slice(0, 80)}…)`,
        );
        if (loadingTimer) clearTimeout(loadingTimer);
        loadingTimer = setTimeout(() => {
          log("warn", "Source timed out after 8s. Falling back…");
          playCandidate(index + 1, "Stream took too long to start.");
        }, 8000);

      const streamType = candidate.type ?? "auto";
      const isHls =
        streamType === "m3u8" || (streamType === "auto" && candidate.url.includes(".m3u8"));

      if (!isHls) {
        log("info", "Direct MP4 playback");
        video.src = candidate.url;
        video.load();
        return;
      }

      // Native HLS (Safari, iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        log("info", "Using native HLS playback");
        video.src = candidate.url;
        video.load();
        return;
      }

      if (Hls.isSupported()) {
        log("info", "Using hls.js MSE playback");
        hls = new Hls({ enableWorker: true });
        hls.loadSource(candidate.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, markReady);
        hls.on(
          Hls.Events.ERROR,
          (_evt: unknown, data: { fatal: boolean; details: string; type?: string }) => {
            log(
              data.fatal ? "error" : "warn",
              `hls.js ${data.type ?? "error"}: ${data.details}${data.fatal ? " (fatal)" : ""}`,
            );
            if (data.fatal) {
              const reason =
                data.details === "manifestLoadError"
                  ? "HLS manifest blocked or unreachable"
                  : data.details;
              playCandidate(index + 1, `HLS failed (${reason}). Trying next source.`);
            }
          },
        );
        return;
      }

      log("error", "HLS not supported in this browser, no MP4 fallback");
      playCandidate(index + 1, "HLS is not supported in this browser.");
    };

    const handleReady = () => markReady();
    const handleVideoError = () => {
      const code = video.error?.code;
      const reason =
        code === 4
          ? "MEDIA_ERR_SRC_NOT_SUPPORTED — format/codec unsupported"
          : code === 3
            ? "MEDIA_ERR_DECODE — broken stream"
            : code === 2
              ? "MEDIA_ERR_NETWORK — network blocked"
              : `video error (code ${code ?? "?"})`;
      log("error", reason);
      const currentIndex = candidates.findIndex(
        (c) => c.url === video.currentSrc || c.url === video.src,
      );
      playCandidate(Math.max(currentIndex, 0) + 1, reason);
    };

    video.addEventListener("canplay", handleReady);
    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("error", handleVideoError);
    playCandidate(0);

    return () => {
      stopped = true;
      if (loadingTimer) clearTimeout(loadingTimer);
      cleanupHls();
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("error", handleVideoError);
    };
    // attempt is included so a Retry click re-runs the whole effect
  }, [fallbackSources, src, type, attempt, log]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="space-y-2">
      <div className="relative w-full aspect-video bg-bg-primary rounded-2xl overflow-hidden border border-border">
        <video
          ref={ref}
          controls
          playsInline
          poster={poster}
          className="w-full h-full bg-bg-primary"
        />
        {isLoading && !error && (
          <div className="absolute inset-0 grid place-items-center bg-bg-primary/80 text-center p-6">
            <div>
              <div className="mx-auto mb-3 size-9 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              <p className="text-sm font-semibold text-foreground">Starting stream…</p>
              {activeLabel && (
                <p className="mt-1 text-xs text-muted-foreground">Loading {activeLabel}</p>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-bg-primary/90 p-6 text-center">
            <div className="max-w-md">
              <AlertTriangle className="mx-auto mb-2 size-6 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Stream unavailable</p>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <button
                onClick={retry}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:opacity-90"
              >
                <RefreshCw className="size-4" /> Retry
              </button>
            </div>
          </div>
        )}
      </div>
      {diagnostics.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Player diagnostics ({diagnostics.length})
          </summary>
          <ul className="mt-2 space-y-1 font-mono">
            {diagnostics.map((d, i) => (
              <li
                key={i}
                className={
                  d.level === "error"
                    ? "text-destructive"
                    : d.level === "warn"
                      ? "text-amber-400"
                      : "text-muted-foreground"
                }
              >
                [{new Date(d.at).toLocaleTimeString()}] {d.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
