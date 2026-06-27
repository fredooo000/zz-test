import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface WatchProgress {
  id: string;
  user_id: string;
  media_id: string;
  kind: string;
  title: string;
  image: string | null;
  episode_id: string | null;
  episode_title: string | null;
  episode_number: number | null;
  season_number: number | null;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  updated_at: string;
}

export function useContinueWatching() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["watch-progress", "continue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_watch_progress")
        .select("*")
        .eq("user_id", user!.id)
        .eq("completed", false)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as WatchProgress[];
    },
  });
}

export function useRecentlyWatched() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["watch-progress", "recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_watch_progress")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as WatchProgress[];
    },
  });
}

export function useUpdateProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (progress: {
      media_id: string;
      kind: string;
      title: string;
      image?: string | null;
      episode_id?: string;
      episode_title?: string;
      episode_number?: number;
      season_number?: number;
      progress_seconds: number;
      duration_seconds: number;
      completed?: boolean;
    }) => {
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase.from("user_watch_progress").upsert(
        {
          user_id: user.id,
          media_id: progress.media_id,
          kind: progress.kind as Database["public"]["Enums"]["media_kind"],
          title: progress.title,
          image: progress.image || null,
          episode_id: progress.episode_id || null,
          episode_title: progress.episode_title || null,
          episode_number: progress.episode_number || null,
          season_number: progress.season_number || null,
          progress_seconds: progress.progress_seconds,
          duration_seconds: progress.duration_seconds,
          completed: progress.completed ?? progress.progress_seconds / progress.duration_seconds > 0.9,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,media_id,episode_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watch-progress"] });
    },
    onError: (err) => {
      // Surface the real reason once so failures aren't invisible. The most
      // common cause is the user_watch_progress table/migration not being
      // applied to the database (error mentions the relation), or an expired
      // session. Silent failures here look like "history doesn't work".
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to save watch progress:", err);
      toast.error(`Couldn't save to history: ${msg}`, { id: "watch-progress-error" });
    },
  });
}

export function useRemoveProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_watch_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["watch-progress"] });
      const snapshots = qc.getQueriesData<WatchProgress[]>({ queryKey: ["watch-progress"] });
      for (const [key, rows] of snapshots) {
        if (Array.isArray(rows)) {
          qc.setQueryData(
            key,
            rows.filter((r) => r.id !== id),
          );
        }
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, rows]) => qc.setQueryData(key, rows));
      toast.error("Couldn't remove from history");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["watch-progress"] });
    },
  });
}

export function useWatchProgressCount() {
  const continueWatching = useContinueWatching();
  const recentlyWatched = useRecentlyWatched();

  return {
    continueWatchingCount: continueWatching.data?.length ?? 0,
    recentlyWatchedCount: recentlyWatched.data?.length ?? 0,
    isLoading: continueWatching.isLoading || recentlyWatched.isLoading,
  };
}
