ALTER TABLE public.speed_results ADD COLUMN owner_id UUID;
CREATE INDEX speed_results_owner_at_idx ON public.speed_results (owner_id, at DESC);