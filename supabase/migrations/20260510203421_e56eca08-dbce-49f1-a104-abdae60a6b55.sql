
-- Drop broad SELECT policies (public buckets still serve files via direct URL)
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Public read post images" on storage.objects;

-- Lock down SECURITY DEFINER functions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Set search_path on touch_updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
