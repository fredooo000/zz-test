CREATE TYPE public.media_kind AS ENUM ('anime','manga','manhwa','movie');
CREATE TYPE public.library_status AS ENUM ('favorite','watchlist');

CREATE TABLE public.user_library (
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

CREATE INDEX ON public.user_library (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_library TO authenticated;
GRANT ALL ON public.user_library TO service_role;

ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library"
  ON public.user_library FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);