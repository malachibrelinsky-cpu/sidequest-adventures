create table if not exists public.phone_otps (
  phone_e164 text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists phone_otps_expires_at_idx on public.phone_otps(expires_at);

alter table public.phone_otps enable row level security;
-- No policies → only service role can access.