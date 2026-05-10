CREATE OR REPLACE FUNCTION public.validate_post_quest_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.difficulty IS NOT NULL AND NEW.difficulty NOT IN ('easy','medium','hard','epic') THEN
    RAISE EXCEPTION 'Invalid difficulty: %', NEW.difficulty;
  END IF;
  IF NEW.points IS NOT NULL AND (NEW.points < 0 OR NEW.points > 150) THEN
    RAISE EXCEPTION 'Points must be between 0 and 150';
  END IF;
  RETURN NEW;
END;
$$;