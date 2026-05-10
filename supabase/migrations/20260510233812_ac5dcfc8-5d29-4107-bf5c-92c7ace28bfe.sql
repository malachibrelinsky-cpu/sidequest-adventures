
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS participants_needed integer,
  ADD COLUMN IF NOT EXISTS quest_time timestamptz,
  ADD COLUMN IF NOT EXISTS location text;

CREATE TABLE IF NOT EXISTS public.quest_participants (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.quest_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants viewable by authenticated"
  ON public.quest_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users join themselves"
  ON public.quest_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users leave themselves"
  ON public.quest_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_quest_participant(_post uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.quest_participants WHERE post_id = _post AND user_id = _user);
$$;

CREATE TABLE IF NOT EXISTS public.quest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read quest messages"
  ON public.quest_messages FOR SELECT TO authenticated
  USING (public.is_quest_participant(post_id, auth.uid()));

CREATE POLICY "Participants send quest messages"
  ON public.quest_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_quest_participant(post_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quest_messages_post_created
  ON public.quest_messages (post_id, created_at);

-- Auto-add the quest creator as the first participant
CREATE OR REPLACE FUNCTION public.add_owner_as_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.difficulty IS NOT NULL THEN
    INSERT INTO public.quest_participants (post_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_add_owner_participant ON public.posts;
CREATE TRIGGER posts_add_owner_participant
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_participant();

ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_messages;
