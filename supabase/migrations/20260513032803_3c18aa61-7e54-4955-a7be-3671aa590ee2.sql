CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_hash text,
  ADD COLUMN IF NOT EXISTS discoverable_by_contacts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contacts_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_hash_key
  ON public.profiles (phone_hash) WHERE phone_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hash_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(btrim(_phone)) = 0 THEN NULL
    ELSE encode(extensions.digest(lower(btrim(_phone)), 'sha256'), 'hex')
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_phone_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_hash := public.hash_phone(NEW.phone_e164);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_phone_hash ON public.profiles;
CREATE TRIGGER trg_profiles_phone_hash
BEFORE INSERT OR UPDATE OF phone_e164 ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_phone_hash();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, display_name, avatar_url, phone_e164)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Quester'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.phone, '')
  )
  on conflict (id) do update
    set phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_phone_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if NEW.phone is distinct from OLD.phone then
    update public.profiles
      set phone_e164 = nullif(NEW.phone, '')
      where id = NEW.id;
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_phone_update ON auth.users;
CREATE TRIGGER trg_auth_user_phone_update
AFTER UPDATE OF phone ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_phone_update();

REVOKE SELECT (phone_e164, phone_hash) ON public.profiles FROM authenticated;
GRANT  SELECT (phone_e164, phone_hash) ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_profile_phone()
RETURNS TABLE(phone_e164 text, discoverable_by_contacts boolean, contacts_synced_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone_e164, p.discoverable_by_contacts, p.contacts_synced_at
  FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.find_friends_by_phone_hashes(hashes text[])
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.phone_hash = ANY(hashes)
    AND p.discoverable_by_contacts = true
    AND p.id <> auth.uid()
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.mark_contacts_synced()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET contacts_synced_at = now() WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.find_friends_by_phone_hashes(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_contacts_synced() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_phone(text) TO authenticated;