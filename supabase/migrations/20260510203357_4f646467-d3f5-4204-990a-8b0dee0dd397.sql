
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  interests text[] default '{}'::text[],
  city text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text,
  image_urls text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create index posts_created_at_idx on public.posts(created_at desc);

create policy "Posts viewable by authenticated"
  on public.posts for select to authenticated using (true);
create policy "Users insert own posts"
  on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own posts"
  on public.posts for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own posts"
  on public.posts for delete to authenticated using (auth.uid() = user_id);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create index comments_post_id_idx on public.comments(post_id, created_at);

create policy "Comments viewable by authenticated"
  on public.comments for select to authenticated using (true);
create policy "Users insert own comments"
  on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own comments"
  on public.comments for delete to authenticated using (auth.uid() = user_id);

-- STORAGE
insert into storage.buckets (id, name, public) values ('avatars','avatars', true);
insert into storage.buckets (id, name, public) values ('post-images','post-images', true);

create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public read post images" on storage.objects for select using (bucket_id = 'post-images');
create policy "Users upload own post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
