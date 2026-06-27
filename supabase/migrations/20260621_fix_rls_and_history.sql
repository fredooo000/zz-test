-- Fixes:
--   1. Watchlist/favorite items "flicker back" when removed -> the user_library
--      DELETE was silently blocked by row-level security (no DELETE policy).
--   2. No watch history -> the user_watch_progress table / policies were never
--      applied to the live database.
--
-- This script is fully idempotent: safe to run multiple times in the Supabase
-- SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).

-- ─── Enums (no-op if they already exist) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_kind') THEN
    CREATE TYPE public.media_kind AS ENUM ('anime','manga','manhwa','movie','tv');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'library_status') THEN
    CREATE TYPE public.library_status AS ENUM ('favorite','watchlist');
  END IF;
END$$;

-- Make sure 'tv' is a valid media_kind even if the enum predates it.
ALTER TYPE public.media_kind ADD VALUE IF NOT EXISTS 'tv';

-- ─── user_library ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  kind public.media_kind NOT NULL,
  status public.library_status NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  genre TEXT,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id, status)
);

CREATE INDEX IF NOT EXISTS user_library_user_status_idx
  ON public.user_library (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_library TO authenticated;
GRANT ALL ON public.user_library TO service_role;

ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

-- Recreate the policy so it definitely covers DELETE (FOR ALL = select/insert/update/delete).
DROP POLICY IF EXISTS "Users manage own library" ON public.user_library;
CREATE POLICY "Users manage own library"
  ON public.user_library FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── user_watch_progress ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  kind public.media_kind NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  episode_id TEXT,
  episode_title TEXT,
  episode_number INTEGER,
  season_number INTEGER,
  progress_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id, episode_id)
);

CREATE INDEX IF NOT EXISTS user_watch_progress_recent_idx
  ON public.user_watch_progress (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS user_watch_progress_continue_idx
  ON public.user_watch_progress (user_id, completed, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watch_progress TO authenticated;
GRANT ALL ON public.user_watch_progress TO service_role;

ALTER TABLE public.user_watch_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own watch progress" ON public.user_watch_progress;
CREATE POLICY "Users manage own watch progress"
  ON public.user_watch_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
