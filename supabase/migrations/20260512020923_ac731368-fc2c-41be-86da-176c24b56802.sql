CREATE POLICY "Authenticated read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated read post images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'post-images');