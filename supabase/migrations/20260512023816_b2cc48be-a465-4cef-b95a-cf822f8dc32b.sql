
-- Public chat-media bucket for messages and quest chats
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder (prefix = their user id)
CREATE POLICY "Authenticated upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated read chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

CREATE POLICY "Public read chat media"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'chat-media');

CREATE POLICY "Users delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
