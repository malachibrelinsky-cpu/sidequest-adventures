
-- Helper: is the user currently premium?
CREATE OR REPLACE FUNCTION public.is_user_premium(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_premium FROM public.subscribers WHERE user_id = _uid LIMIT 1),
    false
  );
$$;

-- Helper: start of the current week (Sunday 00:00 UTC)
CREATE OR REPLACE FUNCTION public.current_week_start_utc()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('day', (now() AT TIME ZONE 'UTC'))::timestamptz
       - (EXTRACT(DOW FROM (now() AT TIME ZONE 'UTC'))::int) * interval '1 day';
$$;

-- Server-side post creation with plan-based weekly quotas.
CREATE OR REPLACE FUNCTION public.post_quest(
  p_caption text,
  p_notes text,
  p_location text,
  p_difficulty text,
  p_points integer,
  p_participants_needed integer,
  p_quest_time timestamptz,
  p_image_urls text[],
  p_latitude double precision,
  p_longitude double precision
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  week_start timestamptz;
  total_count int;
  epic_count int;
  new_id uuid;
  default_points int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_difficulty NOT IN ('common','rare','epic','impossible') THEN
    RAISE EXCEPTION 'invalid difficulty';
  END IF;
  IF length(coalesce(trim(p_caption), '')) < 3 THEN
    RAISE EXCEPTION 'caption too short';
  END IF;
  IF length(p_caption) > 150 THEN
    RAISE EXCEPTION 'caption too long';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'notes too long';
  END IF;
  IF p_participants_needed IS NULL OR p_participants_needed < 1 OR p_participants_needed > 50 THEN
    RAISE EXCEPTION 'participants_needed must be 1-50';
  END IF;

  premium := public.is_user_premium(uid);
  week_start := public.current_week_start_utc();

  IF NOT premium THEN
    IF p_difficulty = 'impossible' THEN
      RAISE EXCEPTION 'Impossible quests are Premium-only';
    END IF;

    SELECT count(*) INTO total_count
      FROM public.posts
      WHERE user_id = uid
        AND difficulty IS NOT NULL
        AND created_at >= week_start;
    IF total_count >= 5 THEN
      RAISE EXCEPTION 'Basic plan limit: 5 quests per week';
    END IF;

    IF p_difficulty = 'epic' THEN
      SELECT count(*) INTO epic_count
        FROM public.posts
        WHERE user_id = uid
          AND difficulty = 'epic'
          AND created_at >= week_start;
      IF epic_count >= 1 THEN
        RAISE EXCEPTION 'Basic plan limit: 1 Epic quest per week';
      END IF;
    END IF;
  END IF;

  default_points := CASE p_difficulty
    WHEN 'common' THEN 10
    WHEN 'rare' THEN 25
    WHEN 'epic' THEN 100
    WHEN 'impossible' THEN 150
  END;

  INSERT INTO public.posts (
    user_id, caption, notes, location, difficulty, points,
    participants_needed, quest_time, image_urls, latitude, longitude
  ) VALUES (
    uid,
    trim(p_caption),
    NULLIF(trim(coalesce(p_notes,'')), ''),
    NULLIF(trim(coalesce(p_location,'')), ''),
    p_difficulty,
    COALESCE(p_points, default_points),
    p_participants_needed,
    p_quest_time,
    COALESCE(p_image_urls, '{}'::text[]),
    p_latitude,
    p_longitude
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Server-side quest join with plan-based weekly quotas.
CREATE OR REPLACE FUNCTION public.join_quest(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  q record;
  week_start timestamptz;
  taken_count int;
  capacity int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id, user_id, difficulty, participants_needed
    INTO q
    FROM public.posts WHERE id = p_post_id;
  IF q.id IS NULL THEN RAISE EXCEPTION 'quest not found'; END IF;
  IF q.difficulty IS NULL THEN RAISE EXCEPTION 'not a quest'; END IF;

  -- already in?
  IF EXISTS (SELECT 1 FROM public.quest_participants WHERE post_id = p_post_id AND user_id = uid) THEN
    RETURN;
  END IF;

  -- capacity check
  IF q.participants_needed IS NOT NULL THEN
    SELECT count(*) INTO capacity FROM public.quest_participants WHERE post_id = p_post_id;
    IF capacity >= q.participants_needed THEN
      RAISE EXCEPTION 'Quest is full';
    END IF;
  END IF;

  premium := public.is_user_premium(uid);
  week_start := public.current_week_start_utc();

  IF NOT premium THEN
    IF q.difficulty = 'impossible' THEN
      RAISE EXCEPTION 'Impossible quests are Premium-only';
    END IF;

    IF q.difficulty IN ('rare','epic') THEN
      SELECT count(*) INTO taken_count
        FROM public.quest_participants qp
        JOIN public.posts p ON p.id = qp.post_id
        WHERE qp.user_id = uid
          AND p.difficulty = q.difficulty
          AND qp.joined_at >= week_start;

      IF q.difficulty = 'rare' AND taken_count >= 5 THEN
        RAISE EXCEPTION 'Basic plan limit: 5 Rare quests per week';
      END IF;
      IF q.difficulty = 'epic' AND taken_count >= 2 THEN
        RAISE EXCEPTION 'Basic plan limit: 2 Epic quests per week';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.quest_participants (post_id, user_id) VALUES (p_post_id, uid);
END;
$$;

-- Lock down direct inserts so the only path is through the RPCs.
DROP POLICY IF EXISTS "Users insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users join themselves" ON public.quest_participants;

-- Allow only signed-in users to call the RPCs.
REVOKE ALL ON FUNCTION public.post_quest(text, text, text, text, integer, integer, timestamptz, text[], double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_quest(text, text, text, text, integer, integer, timestamptz, text[], double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.join_quest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_quest(uuid) TO authenticated;
