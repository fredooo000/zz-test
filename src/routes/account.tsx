import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  Heart,
  BookMarked,
  LogIn,
  ArrowRight,
  Clock,
  Film,
  Tv,
  Star,
  Shield,
  Calendar,
  Mail,
  Globe,
  Camera,
  Check,
  X,
  Image,
  Loader2,
  Pencil,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef } from "react";
import { useProfile, useSyncProfile, useUpdateProfile, useAvatarUpload } from "@/hooks/useProfile";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Kyrox" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  useSyncProfile();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const avatarUpload = useAvatarUpload();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="min-h-screen max-w-xl mx-auto flex flex-col items-center justify-center py-24 gap-6">
          <div className="size-20 rounded-full bg-white/5 flex items-center justify-center">
            <User className="size-10 text-slate-400" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl font-extrabold text-white mb-2">
              Welcome to Kyrox
            </h1>
            <p className="text-slate-400">Sign in to track your library, favorites, and more.</p>
          </div>
          <Link
            to="/auth"
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            <LogIn className="size-4" />
            Sign In
            <ArrowRight className="size-4" />
          </Link>
          <div className="flex gap-4 mt-4">
            <Link to="/anime" className="text-sm text-slate-500 hover:text-white transition-colors">Browse Anime</Link>
            <Link to="/manga" className="text-sm text-slate-500 hover:text-white transition-colors">Browse Manga</Link>
            <Link to="/movies" className="text-sm text-slate-500 hover:text-white transition-colors">Browse Movies</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const displayName = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const provider = user.app_metadata?.provider || "email";
  const createdAt = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stats = [
    { icon: Film, label: "Anime", value: "—" },
    { icon: Tv, label: "Episodes", value: "—" },
    { icon: Heart, label: "Favorites", value: "—" },
    { icon: Clock, label: "Hours watched", value: "—" },
  ];

  const handleNameSave = () => {
    if (nameInput.trim()) {
      updateProfile.mutate({ display_name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const handleAvatarUrlSave = () => {
    if (avatarUrlInput.trim()) {
      updateProfile.mutate({ avatar_url: avatarUrlInput.trim() });
    }
    setShowAvatarInput(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarUpload.mutate(file);
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-xl mx-auto"
      >
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8"
        >
          <div className="relative group">
            <div className="size-24 rounded-full overflow-hidden bg-white/5 flex items-center justify-center shrink-0 border-2 border-white/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <User className="size-10 text-slate-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center cursor-pointer"
              aria-label="Change avatar"
            >
              <Camera className="size-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <div className="text-center sm:text-left flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold text-white font-display focus:outline-none focus:border-brand/50 flex-1 min-w-0"
                  placeholder="Display name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <button onClick={handleNameSave} className="size-8 grid place-items-center rounded-lg bg-brand/20 text-brand hover:bg-brand/30 transition-colors">
                  <Check className="size-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="size-8 grid place-items-center rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl font-extrabold text-white">{displayName}</h1>
                <button
                  type="button"
                  onClick={() => { setNameInput(displayName); setEditingName(true); }}
                  className="size-7 grid place-items-center rounded-lg bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all shrink-0"
                  aria-label="Edit display name"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-slate-400">{user.email}</p>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => { setAvatarUrlInput(avatarUrl || ""); setShowAvatarInput(true); }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand transition-colors"
              >
                <Image className="size-3" />
                {avatarUrl ? "Change avatar URL" : "Set avatar URL"}
              </button>
            </div>
            {showAvatarInput && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white flex-1 min-w-0 focus:outline-none focus:border-brand/50"
                  placeholder="Paste image URL..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAvatarUrlSave();
                    if (e.key === "Escape") setShowAvatarInput(false);
                  }}
                />
                <button onClick={handleAvatarUrlSave} className="size-7 grid place-items-center rounded-lg bg-brand/20 text-brand hover:bg-brand/30 transition-colors">
                  <Check className="size-3.5" />
                </button>
                <button onClick={() => setShowAvatarInput(false)} className="size-7 grid place-items-center rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors">
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="size-3" />
                Joined {createdAt}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Shield className="size-3" />
                {provider === "google" ? "Google" : provider === "discord" ? "Discord" : "Email"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/5 rounded-2xl p-4 text-center">
              <Icon className="size-5 mx-auto mb-1 text-brand" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="space-y-3">
          <Link
            to="/library"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group"
          >
            <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <BookMarked className="size-5 text-brand" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">My Library</p>
              <p className="text-xs text-slate-500">Your favorites and watchlist</p>
            </div>
            <ArrowRight className="size-4 text-slate-500 group-hover:text-white transition-colors" />
          </Link>
          <Link
            to="/favorites"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group"
          >
            <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Heart className="size-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Favorites</p>
              <p className="text-xs text-slate-500">Your personally curated collection</p>
            </div>
            <ArrowRight className="size-4 text-slate-500 group-hover:text-white transition-colors" />
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group"
          >
            <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Settings className="size-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Settings</p>
              <p className="text-xs text-slate-500">Theme, playback, and preferences</p>
            </div>
            <ArrowRight className="size-4 text-slate-500 group-hover:text-white transition-colors" />
          </Link>
        </div>

        {/* Connected accounts / providers section */}
        <div className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Account
          </h2>
          <div className="bg-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Mail className="size-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Email</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Shield className="size-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Sign-in method</p>
                  <p className="text-xs text-slate-500 capitalize">{provider}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Calendar className="size-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Member since</p>
                  <p className="text-xs text-slate-500">{createdAt}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Globe className="size-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">User ID</p>
                  <p className="text-xs text-slate-500 font-mono">{user.id.slice(0, 16)}…</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
