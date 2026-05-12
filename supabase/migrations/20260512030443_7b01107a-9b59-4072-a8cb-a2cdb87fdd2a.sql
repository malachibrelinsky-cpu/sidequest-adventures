
-- Add approximate coordinate columns to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS lat_approx double precision,
  ADD COLUMN IF NOT EXISTS lon_approx double precision;

-- Trigger to auto-populate approx columns
CREATE OR REPLACE FUNCTION public.set_post_approx_coords()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NULL THEN
    NEW.lat_approx := NULL;
  ELSE
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

DROP TRIGGER IF EXISTS posts_set_approx_coords ON public.posts;
CREATE TRIGGER posts_set_approx_coords
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_post_approx_coords();

-- Backfill existing rows
UPDATE public.posts
SET lat_approx = CASE WHEN latitude IS NULL THEN NULL ELSE round((latitude * 20)::numeric) / 20 END,
    lon_approx = CASE WHEN longitude IS NULL THEN NULL ELSE round((longitude * 20)::numeric) / 20 END;

-- Restrict column-level SELECT: revoke broad table grant, then re-grant only safe columns.
REVOKE SELECT ON public.posts FROM authenticated, anon, PUBLIC;
GRANT SELECT (
  id, user_id, caption, notes, image_urls, evidence_urls, created_at, completed_at,
  difficulty, points, participants_needed, quest_time, location, lat_approx, lon_approx
) ON public.posts TO authenticated;

-- Owner can read own exact coords via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_my_post_location(p_post_id uuid)
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latitude, longitude
  FROM public.posts
  WHERE id = p_post_id AND user_id = auth.uid();
$$;
