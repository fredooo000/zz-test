import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MediaItem } from "@/lib/catalog";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["library", "favorite", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "favorite")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["library", "watchlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "watchlist")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIsFavorite(mediaId: string) {
  const { data } = useFavorites();
  if (!data) return false;
  return data.some((r) => r.media_id === mediaId);
}

export function useIsWatchlist(mediaId: string) {
  const { data } = useWatchlist();
  if (!data) return false;
  return data.some((r) => r.media_id === mediaId);
}

export function useLibraryActions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const toggleFavorite = useMutation({
    mutationFn: async ({ item, remove }: { item: MediaItem; remove?: boolean }) => {
      if (!user) throw new Error("Sign in to save titles");
      if (remove) {
        const { data, error } = await supabase
          .from("user_library")
          .delete()
          .eq("user_id", user.id)
          .eq("media_id", item.id)
          .eq("status", "favorite")
          .select("id");
        if (error) throw error;
        // A successful request that deleted nothing means RLS/auth blocked it
        // (or the row was already gone) — surface it instead of silently
        // "failing" by having the item reappear after refetch.
        if (!data || data.length === 0) {
          throw new Error("Nothing was removed — you may need to sign in again.");
        }
      } else {
        const { error } = await supabase.from("user_library").upsert(
          {
            user_id: user.id,
            media_id: item.id,
            kind: item.kind,
            status: "favorite",
            title: item.title,
            image: item.image,
            genre: item.genre,
            badge: item.badge,
          },
          { onConflict: "user_id,media_id,status" },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ item, remove }) => {
      await qc.cancelQueries({ queryKey: ["library", "favorite", user?.id] });
      const prev = qc.getQueryData(["library", "favorite", user?.id]);
      qc.setQueryData(["library", "favorite", user?.id], (old: any) => {
        const arr = Array.isArray(old) ? old : [];
        if (remove) return arr.filter((r: any) => r.media_id !== item.id);
        if (arr.some((r: any) => r.media_id === item.id)) return arr;
        return [{
          id: `opt-${Date.now()}`,
          user_id: user?.id,
          media_id: item.id,
          kind: item.kind,
          status: "favorite",
          title: item.title,
          image: item.image,
          genre: item.genre,
          badge: item.badge,
          created_at: new Date().toISOString(),
        }, ...arr];
      });
      return { prev };
    },
    onSuccess: (_data, { remove }) => {
      toast.success(remove ? "Removed from favorites" : "Added to favorites");
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["library", "favorite", user?.id], ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to update favorites");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["library", "favorite"] });
    },
  });

  const toggleWatchlist = useMutation({
    mutationFn: async ({ item, remove }: { item: MediaItem; remove?: boolean }) => {
      if (!user) throw new Error("Sign in to save titles");
      if (remove) {
        const { data, error } = await supabase
          .from("user_library")
          .delete()
          .eq("user_id", user.id)
          .eq("media_id", item.id)
          .eq("status", "watchlist")
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Nothing was removed — you may need to sign in again.");
        }
      } else {
        const { error } = await supabase.from("user_library").upsert(
          {
            user_id: user.id,
            media_id: item.id,
            kind: item.kind,
            status: "watchlist",
            title: item.title,
            image: item.image,
            genre: item.genre,
            badge: item.badge,
          },
          { onConflict: "user_id,media_id,status" },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ item, remove }) => {
      await qc.cancelQueries({ queryKey: ["library", "watchlist", user?.id] });
      const prev = qc.getQueryData(["library", "watchlist", user?.id]);
      qc.setQueryData(["library", "watchlist", user?.id], (old: any) => {
        const arr = Array.isArray(old) ? old : [];
        if (remove) return arr.filter((r: any) => r.media_id !== item.id);
        if (arr.some((r: any) => r.media_id === item.id)) return arr;
        return [{
          id: `opt-${Date.now()}`,
          user_id: user?.id,
          media_id: item.id,
          kind: item.kind,
          status: "watchlist",
          title: item.title,
          image: item.image,
          genre: item.genre,
          badge: item.badge,
          created_at: new Date().toISOString(),
        }, ...arr];
      });
      return { prev };
    },
    onSuccess: (_data, { remove }) => {
      toast.success(remove ? "Removed from watchlist" : "Added to watchlist");
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["library", "watchlist", user?.id], ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to update watchlist");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["library", "watchlist"] });
    },
  });

  const handleToggle = (item: MediaItem, action: "favorite" | "watchlist") => {
    if (!user) {
      toast.error("Sign in to save titles");
      return;
    }
    const isActive = action === "favorite"
      ? qc.getQueryData(["library", "favorite", user?.id])
      : qc.getQueryData(["library", "watchlist", user?.id]);
    const isIn = Array.isArray(isActive)
      ? isActive.some((r: any) => r.media_id === item.id)
      : false;

    const mutation = action === "favorite" ? toggleFavorite : toggleWatchlist;
    mutation.mutate({ item, remove: isIn });
  };

  return { toggleFavorite, toggleWatchlist, handleToggle };
}
