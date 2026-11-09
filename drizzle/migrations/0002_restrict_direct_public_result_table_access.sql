DROP POLICY IF EXISTS "Anyone can view shared results" ON public.public_results;
REVOKE ALL PRIVILEGES ON TABLE public.public_results FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.public_results TO service_role;
ALTER TABLE public.public_results ENABLE ROW LEVEL SECURITY;