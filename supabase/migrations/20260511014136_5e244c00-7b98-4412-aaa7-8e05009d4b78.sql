
-- 1) Coarsen profile coordinates: add approx columns, populate via trigger, revoke direct exact column reads
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lat_approx double precision,
  ADD COLUMN IF NOT EXISTS lon_approx double precision;

CREATE OR REPLACE FUNCTION public.set_profile_approx_coords()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NULL THEN
    NEW.lat_approx := NULL;
  ELSE
    -- ~5.5km grid (round to 0.05 degrees)
    NEW.lat_approx := round((NEW.latitude * 20)::numeric) / 20;
  END IF;
  IF NEW.longitude IS NULL THEN
    NEW.lon_approx := NULL;
  ELSE
    NEW.lon_approx := round((NEW.longitude * 20)::numeric) / 20;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_approx_coords ON public.profiles;
CREATE TRIGGER trg_profile_approx_coords
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_approx_coords();

-- Backfill
UPDATE public.profiles
SET lat_approx = round((latitude * 20)::numeric) / 20,
    lon_approx = round((longitude * 20)::numeric) / 20
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Revoke direct read access on exact coordinate columns
REVOKE SELECT (latitude, longitude) ON public.profiles FROM anon, authenticated, PUBLIC;

-- Allow users to read their OWN exact coordinates via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_my_location()
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latitude, longitude FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_location() TO authenticated;

-- 2) Lock down quest_completions: only the screen-quest-completion edge function (service role) may insert.
DROP POLICY IF EXISTS "Users insert own completions" ON public.quest_completions;

ALTER TABLE public.quest_completions
  DROP CONSTRAINT IF EXISTS quest_completions_points_chk,
  DROP CONSTRAINT IF EXISTS quest_completions_created_at_chk,
  DROP CONSTRAINT IF EXISTS quest_completions_difficulty_chk;

ALTER TABLE public.quest_completions
  ADD CONSTRAINT quest_completions_points_chk CHECK (points >= 0 AND points <= 500),
  ADD CONSTRAINT quest_completions_difficulty_chk CHECK (difficulty IN ('easy','medium','hard','epic'));

-- created_at sanity via trigger (CHECK can't use now())
CREATE OR REPLACE FUNCTION public.validate_quest_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_at IS NULL OR NEW.created_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'created_at must not be in the future';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_quest_completion ON public.quest_completions;
CREATE TRIGGER trg_validate_quest_completion
BEFORE INSERT OR UPDATE ON public.quest_completions
FOR EACH ROW EXECUTE FUNCTION public.validate_quest_completion();

-- 3) Streak revive RPC: validates premium server-side and writes both rows authoritatively.
CREATE OR REPLACE FUNCTION public.revive_streak()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  sub_row record;
  last_comp timestamptz;
  period_start timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT is_premium, current_period_end, last_streak_revive_at
    INTO sub_row
    FROM public.subscribers WHERE user_id = uid;

  IF sub_row IS NULL OR NOT sub_row.is_premium THEN
    RAISE EXCEPTION 'premium required';
  END IF;

  IF sub_row.current_period_end IS NOT NULL THEN
    period_start := sub_row.current_period_end - interval '31 days';
    IF sub_row.last_streak_revive_at IS NOT NULL
       AND sub_row.last_streak_revive_at >= period_start THEN
      RAISE EXCEPTION 'revive already used this period';
    END IF;
  END IF;

  SELECT max(created_at) INTO last_comp
    FROM public.quest_completions WHERE user_id = uid;

  IF last_comp IS NULL THEN
    RAISE EXCEPTION 'no prior completions to revive';
  END IF;

  -- bridge completion 71h after last (window is 72h)
  INSERT INTO public.quest_completions (user_id, title, difficulty, points, created_at)
  VALUES (uid, '🛟 Streak revive', 'easy', 0, least(last_comp + interval '71 hours', now()));

  UPDATE public.subscribers
    SET last_streak_revive_at = now(), updated_at = now()
    WHERE user_id = uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revive_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revive_streak() TO authenticated;
