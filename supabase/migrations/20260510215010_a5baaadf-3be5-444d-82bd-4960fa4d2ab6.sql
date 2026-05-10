
-- Quest completions: log each completed sidequest with difficulty + points
CREATE TABLE public.quest_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard','epic')),
  points INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quest_completions_user ON public.quest_completions(user_id);
CREATE INDEX idx_quest_completions_created ON public.quest_completions(created_at DESC);

ALTER TABLE public.quest_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Completions viewable by authenticated"
  ON public.quest_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own completions"
  ON public.quest_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own completions"
  ON public.quest_completions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Private leaderboards (premium feature)
CREATE TABLE public.leaderboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT lower(substr(md5(random()::text), 1, 8)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leaderboard_members (
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (leaderboard_id, user_id)
);

ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_members ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_leaderboard_member(_lb UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.leaderboard_members WHERE leaderboard_id = _lb AND user_id = _user);
$$;

CREATE POLICY "Members or owner view leaderboard"
  ON public.leaderboards FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_leaderboard_member(id, auth.uid()));
CREATE POLICY "Owner creates leaderboard"
  ON public.leaderboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes leaderboard"
  ON public.leaderboards FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner updates leaderboard"
  ON public.leaderboards FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Members view membership"
  ON public.leaderboard_members FOR SELECT TO authenticated
  USING (public.is_leaderboard_member(leaderboard_id, auth.uid()));
CREATE POLICY "Users join themselves"
  ON public.leaderboard_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave themselves"
  ON public.leaderboard_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
