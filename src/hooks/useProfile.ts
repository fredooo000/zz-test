import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: string | null;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as Profile | null;
    },
  });
}

export function useSyncProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const avatarUrl = user.user_metadata?.avatar_url;
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      null;

    const sync = async () => {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, avatar_source")
        .eq("id", user.id)
        .single();

      if (existing) return;

      await supabase.from("profiles").insert({
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        avatar_source: avatarUrl ? "oauth" : null,
      });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    };

    sync();
  }, [user, qc]);
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { display_name?: string; avatar_url?: string | null }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          avatar_source: updates.avatar_url !== undefined ? "custom" : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    },
  });
}

export function useAvatarUpload() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      return urlData.publicUrl;
    },
    onSuccess: (publicUrl) => {
      updateProfile.mutate({ avatar_url: publicUrl });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    },
  });

  return upload;
}
