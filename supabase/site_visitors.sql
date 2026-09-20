-- Rode no SQL Editor do Supabase.
CREATE TABLE IF NOT EXISTS public.site_visitors (
  ip_hash       TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.site_visitors
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
