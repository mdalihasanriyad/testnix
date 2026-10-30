create table public.speed_results (
  id uuid primary key default gen_random_uuid(),
  device_key text not null,
  download double precision not null,
  upload double precision not null,
  ping double precision not null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index speed_results_device_at_idx on public.speed_results (device_key, at desc);

grant select, insert, delete on public.speed_results to anon;
grant all on public.speed_results to service_role;

alter table public.speed_results enable row level security;

create policy "anon can read own device results"
  on public.speed_results for select to anon
  using (device_key = current_setting('request.headers', true)::jsonb->>'x-device-key');

create policy "anon can insert own device results"
  on public.speed_results for insert to anon
  with check (
    device_key = current_setting('request.headers', true)::jsonb->>'x-device-key'
    and char_length(device_key) between 8 and 64
  );

create policy "anon can delete own device results"
  on public.speed_results for delete to anon
  using (device_key = current_setting('request.headers', true)::jsonb->>'x-device-key');