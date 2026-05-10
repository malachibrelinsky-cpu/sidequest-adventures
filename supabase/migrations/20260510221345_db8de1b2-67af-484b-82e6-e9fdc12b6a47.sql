ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS points INTEGER;

CREATE OR REPLACE FUNCTION public.validate_post_quest_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.difficulty IS NOT NULL AND NEW.difficulty NOT IN ('easy','medium','hard','epic') THEN
    RAISE EXCEPTION 'Invalid difficulty: %', NEW.difficulty;
  END IF;
  IF NEW.points IS NOT NULL AND (NEW.points < 0 OR NEW.points > 500) THEN
    RAISE EXCEPTION 'Points must be between 0 and 500';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_validate_quest_fields ON public.posts;
CREATE TRIGGER posts_validate_quest_fields
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.validate_post_quest_fields();