CREATE TABLE public.public_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT,
  city TEXT,
  connection_type TEXT,
  device TEXT,
  plan_speed TEXT,
  issue TEXT,
  download DOUBLE PRECISION NOT NULL,
  upload DOUBLE PRECISION NOT NULL,
  ping DOUBLE PRECISION NOT NULL,
  verdict TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_results TO anon;
GRANT SELECT ON public.public_results TO authenticated;
GRANT ALL ON public.public_results TO service_role;

ALTER TABLE public.public_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared results"
  ON public.public_results FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX public_results_created_at_idx ON public.public_results (created_at DESC);