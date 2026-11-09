DROP POLICY IF EXISTS "anon can delete own device results" ON public.speed_results;
DROP POLICY IF EXISTS "anon can insert own device results" ON public.speed_results;
DROP POLICY IF EXISTS "anon can read own device results" ON public.speed_results;
REVOKE ALL PRIVILEGES ON TABLE public.speed_results FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.speed_results TO service_role;
ALTER TABLE public.speed_results ENABLE ROW LEVEL SECURITY;