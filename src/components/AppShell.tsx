import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import {
  Home,
  Film,
  Tv,
  Search,
  Menu,
  Heart,
  LogOut,
  User as UserIcon,
  X,
  Library,
  Settings,
  BookOpen,
  Sparkles,
  Bot,
  Globe,
  Clock,
  Download,
  History,
  List,
  ChevronRight,
  TrendingUp,
  Headphones,
  Disc3,
} from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

const mainNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/library", label: "Library", icon: Heart },
  { to: "/more", label: "More", icon: Menu },
] as const;

const drawerItems = [
  { to: "/tv", label: "TV Shows", icon: Tv },
  { to: "/search", label: "Search", icon: Search },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/account", label: "Profile", icon: UserIcon },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/manga", label: "Manga", icon: BookOpen },
  { to: "/manhwa", label: "Manhwa", icon: Sparkles },
  { to: "/ai", label: "Kyrox AI", icon: Bot },
  { to: "/proxy", label: "Browser", icon: Globe },
] as const;

const secondaryNav = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/account", label: "Account", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

// Desktop sidebar navigation, grouped. The previous desktop sidebar only
// rendered `drawerItems`, so primary destinations (Home, Anime, Movies, TV)
// were unreachable from the sidebar on desktop.
const desktopNavGroups = [
  {
    label: "Browse",
    items: [
      { to: "/", label: "Home", icon: Home },
      { to: "/anime", label: "Anime", icon: Tv },
      { to: "/movies", label: "Movies", icon: Film },
      { to: "/tv", label: "TV Shows", icon: Tv },
      { to: "/manga", label: "Manga", icon: BookOpen },
      { to: "/manhwa", label: "Manhwa", icon: Sparkles },
    ],
  },
  {
    label: "Discover",
    items: [
      { to: "/search", label: "Search", icon: Search },
      { to: "/ai", label: "Kyrox AI", icon: Bot },
      { to: "/proxy", label: "Browser", icon: Globe },
    ],
  },
] as const;

function DesktopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto">
      {desktopNavGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            {group.label}
          </p>
          {group.items.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 active:scale-[0.97] ${
                  active ? "bg-brand/15 text-brand" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="font-medium text-sm">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-1">
      {drawerItems.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 active:scale-[0.97] ${
              active ? "bg-brand/15 text-brand" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="size-5 shrink-0" />
            <span className="font-medium text-sm">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="flex items-center gap-2 px-3 sm:px-4 h-10 rounded-full bg-brand text-white text-sm font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-brand/25"
      >
        <UserIcon className="size-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="size-9 rounded-full overflow-hidden border border-white/10 hover:border-brand/50 transition-all duration-200 bg-surface grid place-items-center active:scale-90"
        aria-label="User menu"
      >
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt=""
            className="size-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <UserIcon className="size-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-56 bg-bg-secondary border border-white/10 rounded-2xl p-2 shadow-2xl z-50"
          >
            <div className="px-3 py-2 border-b border-white/5 mb-1">
              <p className="text-sm font-medium text-white truncate">
                {user.email?.split("@")[0] || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            {secondaryNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            <div className="border-t border-white/5 mt-1 pt-1">
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const sectionKind = path.startsWith("/tv") ? "tv" as const
    : path.startsWith("/movies") ? "movie" as const
    : path.startsWith("/anime") ? "anime" as const
    : path.startsWith("/manga") ? "manga" as const
    : path.startsWith("/manhwa") ? "manhwa" as const
    : undefined;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      router.navigate({ to: "/search", search: { q: q.trim(), kind: sectionKind ?? "all" } });
    }
  };

  const isActive = (to: string) => to === "/" ? path === "/" : path.startsWith(to);

  return (
    <div className="min-h-screen flex bg-bg-primary text-foreground">
      <aside className="hidden md:flex w-60 border-r border-white/5 flex-col py-8 px-4 gap-10 shrink-0 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2 px-2">
          <img
            src="https://i.postimg.cc/h4JqFVG2/9aa7550e8426fee1389cc54abdd7e9c5.jpg"
            alt="Kyrox"
            className="h-12 w-auto rounded-xl"
          />
        </Link>
        <DesktopNav />
        <div className="space-y-1 mt-auto mb-4">
          {secondaryNav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-white/5 text-brand"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="font-medium text-sm">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-600 px-2">
          v0.2 • dark-matter
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 z-50 bg-bg-secondary border-r border-white/10 flex flex-col py-6 px-4 gap-8"
            >
              <div className="flex items-center justify-between px-2">
                <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2">
                  <img
                    src="https://i.postimg.cc/h4JqFVG2/9aa7550e8426fee1389cc54abdd7e9c5.jpg"
                    alt="Kyrox"
                    className="h-12 w-auto rounded-xl"
                  />
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="size-10 grid place-items-center rounded-lg hover:bg-white/5 active:scale-90 transition-all"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
              <NavItems onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 px-2 sm:px-6 lg:px-12 pt-5 sm:pt-4 pb-2 sm:pb-4 flex items-center justify-between gap-2 sm:gap-6 bg-bg-primary/70 backdrop-blur-xl border-b border-white/5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden size-11 sm:size-10 grid place-items-center rounded-xl glass shrink-0 active:scale-90 transition-all"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <form onSubmit={handleSearch} className="relative flex-1 max-w-xl group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-brand transition-colors" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="text"
              placeholder="Search..."
              className="w-full bg-surface/50 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600"
              aria-label="Search"
            />
          </form>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <UserMenu />
          </div>
        </header>

        <div className="px-3 sm:px-6 lg:px-12 py-3 sm:py-8 pb-14 md:pb-8 animate-fade-in">
          {children}
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-2xl border-t border-white/10 shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex items-center justify-around h-14 px-2">
            {mainNav.map(({ to, label, icon: Icon }) => {
              if (to === "/more") {
                return (
                  <button
                    key={to}
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className={`flex flex-col items-center justify-center gap-0 px-2 py-1 rounded-xl transition-all min-w-0 flex-1 max-w-[72px] active:scale-90 ${
                      drawerOpen ? "text-brand" : "text-slate-500 hover:text-slate-300"
                    }`}
                    aria-label="More options"
                  >
                    <div className={`size-9 rounded-xl grid place-items-center transition-all duration-200 ${
                      drawerOpen ? "bg-brand/15" : ""
                    }`}>
                      <Icon className="size-5 shrink-0" />
                    </div>
                    <span className="text-[8px] font-medium leading-tight truncate w-full text-center">
                      {label}
                    </span>
                  </button>
                );
              }
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center justify-center gap-0 px-2 py-1 rounded-xl transition-all min-w-0 flex-1 max-w-[72px] active:scale-90 ${
                    active ? "text-brand" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <div className={`size-9 rounded-xl grid place-items-center transition-all duration-200 ${
                    active ? "bg-brand/15" : ""
                  }`}>
                    <Icon className="size-5 shrink-0" />
                  </div>
                  <span className="text-[8px] font-medium leading-tight truncate w-full text-center">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </main>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="md:hidden fixed bottom-14 left-0 right-0 z-50 bg-bg-secondary/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl max-h-[70vh] overflow-y-auto safe-area-bottom"
            >
              <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-2xl pt-4 pb-2 px-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Explore</h2>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="size-8 grid place-items-center rounded-lg hover:bg-white/5 active:scale-90 transition-all"
                    aria-label="Close drawer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-1">
                {drawerItems.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 active:scale-[0.97] ${
                        active
                          ? "bg-brand/15 text-brand"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className={`size-9 rounded-xl grid place-items-center ${
                        active ? "bg-brand/20" : "bg-white/5"
                      }`}>
                        <Icon className="size-[18px]" />
                      </div>
                      <span className="text-sm font-medium">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
