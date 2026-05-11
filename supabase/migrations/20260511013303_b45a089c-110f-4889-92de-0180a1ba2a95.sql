
-- 1) user_roles: prevent self-grant; require existing admin via SECURITY DEFINER has_role
DROP POLICY IF EXISTS "Admins manage roles insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles delete" ON public.user_roles;

CREATE POLICY "Admins grant roles to others"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND user_id <> auth.uid()
);

CREATE POLICY "Admins revoke roles from others"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND user_id <> auth.uid()
);

-- 2) user_moderation: restrict reads to self + mods/admins
DROP POLICY IF EXISTS "Mod status viewable by authenticated" ON public.user_moderation;

CREATE POLICY "Users view own moderation; mods view all"
ON public.user_moderation
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

-- 3) Storage: avatars DELETE policy
CREATE POLICY "Users delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) Storage: post-images UPDATE policy
CREATE POLICY "Users update own post images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
