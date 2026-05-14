
create table public.quan_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index quan_messages_user_created_idx
  on public.quan_messages (user_id, created_at desc);

alter table public.quan_messages enable row level security;

create policy "Users read own quan messages"
  on public.quan_messages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own quan messages"
  on public.quan_messages for insert
  to authenticated
  with check (auth.uid() = user_id);
