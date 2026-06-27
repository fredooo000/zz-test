import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Kyrox — Stream Anime, Movies & TV · Read Manga & Manhwa" },
      {
        name: "description",
        content:
          "Kyrox is an all-in-one hub to stream anime, movies and TV shows, read manga and manhwa, and track your favorites, watchlist and watch history — synced across devices.",
      },
      {
        name: "keywords",
        content:
          "anime streaming, watch anime free, movies, tv shows, read manga, manhwa, watchlist, Kyrox",
      },
      { property: "og:site_name", content: "Kyrox" },
      { property: "og:title", content: "Kyrox — Stream Anime, Movies & TV · Read Manga & Manhwa" },
      {
        property: "og:description",
        content:
          "Stream anime, movies and TV shows, read manga and manhwa, and keep your favorites, watchlist and history in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Kyrox — Stream Anime, Movies & TV" },
      {
        name: "twitter:description",
        content:
          "All-in-one hub to stream anime, movies and TV, read manga and manhwa, and track what you watch.",
      },
      // PWA / installability
      { name: "theme-color", content: "#0a0a0f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Kyrox" },
      { name: "format-detection", content: "telephone=no" },
      { name: "HandheldFriendly", content: "true" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/app-icon.jpg" },
      { rel: "apple-touch-icon", href: "/app-icon.jpg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  // Disable SSR of the app itself — only the lightweight <html> shell
  // (RootShell) renders on the server. The whole app renders on the client.
  // Pairs with SPA mode (vite.config.ts) to eliminate the per-request SSR that
  // was timing out and 500-crashing on the slow disk.
  ssr: false,
});

// Applies the saved theme before first paint to avoid a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme')||'dark';var d=t==='system'?((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'):t;var c=document.documentElement.classList;c.toggle('light',d==='light');c.toggle('dark',d!=='light');}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const [reduceMotion, setReduceMotion] = useState(false);

  // The SSR error page (lib/error-page.ts) auto-retries on transient 500s using
  // sessionStorage counters. Once the real app mounts, the page clearly loaded,
  // so clear those counters to give future transient errors a fresh retry budget.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("kyrox-ssr-retry:")) sessionStorage.removeItem(key);
      }
    } catch {
      /* sessionStorage may be unavailable (privacy mode) — non-fatal */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      try {
        const s = JSON.parse(localStorage.getItem("haven-settings") || "{}");
        setReduceMotion(!!s.reduceMotion);
      } catch {
        setReduceMotion(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("kyrox-settings-changed", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("kyrox-settings-changed", check);
    };
  }, []);

  // Register the service worker so Kyrox is installable / works offline.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </QueryClientProvider>
    </MotionConfig>
  );
}
