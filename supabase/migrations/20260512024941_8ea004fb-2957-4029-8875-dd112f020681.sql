
-- Lock down precise coordinates on profiles by replacing the broad table-level
-- SELECT grant with a column-allowlist that excludes latitude/longitude.
REVOKE SELECT ON public.profiles FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id, display_name, avatar_url, bio, city, interests,
  lat_approx, lon_approx, map_color, created_at, updated_at
) ON public.profiles TO authenticated;

-- Owners read their own precise coords via public.get_my_location() (already exists).

-- Remove broad listing policies on public file buckets. Public file URLs
-- continue to work; only directory listing via the storage SDK is blocked.
DROP POLICY IF EXISTS "Authenticated read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read post images" ON storage.objects;
