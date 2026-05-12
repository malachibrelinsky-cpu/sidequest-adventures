CREATE OR REPLACE FUNCTION public.post_update(
  p_caption text,
  p_image_urls text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  cap text := nullif(btrim(coalesce(p_caption, '')), '');
  imgs text[] := coalesce(p_image_urls, ARRAY[]::text[]);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF cap IS NULL AND array_length(imgs, 1) IS NULL THEN
    RAISE EXCEPTION 'Add a caption or at least one photo';
  END IF;
  IF cap IS NOT NULL AND length(cap) > 150 THEN
    RAISE EXCEPTION 'Caption must be under 150 chars';
  END IF;
  IF array_length(imgs, 1) > 6 THEN
    RAISE EXCEPTION 'Up to 6 images';
  END IF;

  INSERT INTO public.posts (user_id, caption, image_urls, difficulty, points, participants_needed)
  VALUES (uid, cap, imgs, NULL, NULL, NULL)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_update(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_update(text, text[]) TO authenticated;