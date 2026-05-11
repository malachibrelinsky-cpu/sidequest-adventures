-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles viewable by authenticated"
  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Profile ratings
CREATE TABLE public.profile_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  stars int NOT NULL,
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, ratee_id),
  CHECK (stars BETWEEN 1 AND 5),
  CHECK (rater_id <> ratee_id),
  CHECK (review IS NULL OR char_length(review) <= 100)
);
ALTER TABLE public.profile_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings viewable by authenticated"
  ON public.profile_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own ratings"
  ON public.profile_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rater_id AND rater_id <> ratee_id);
CREATE POLICY "Users update own ratings"
  ON public.profile_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rater_id);
CREATE POLICY "Users delete own ratings"
  ON public.profile_ratings FOR DELETE TO authenticated
  USING (auth.uid() = rater_id);

CREATE TRIGGER profile_ratings_touch
  BEFORE UPDATE ON public.profile_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_profile_ratings_ratee ON public.profile_ratings(ratee_id);

-- 3. User reports
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  reason text NOT NULL,
  context text,
  ai_verdict text,           -- 'dismiss' | 'warn' | 'escalate' | 'recommend_suspend' | 'recommend_ban' | 'error'
  ai_reasoning text,
  ai_reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'ai_screened' | 'resolved'
  resolution text,           -- 'dismissed' | 'warned' | 'suspended' | 'banned'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_user_id),
  CHECK (char_length(reason) BETWEEN 3 AND 500)
);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters view own reports"
  ON public.user_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "Users file reports"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Mods update reports"
  ON public.user_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX idx_user_reports_status ON public.user_reports(status);
CREATE INDEX idx_user_reports_reported ON public.user_reports(reported_user_id);

-- 4. Moderation status
CREATE TABLE public.user_moderation (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'warned' | 'suspended' | 'banned'
  reason text,
  until timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('active','warned','suspended','banned'))
);
ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mod status viewable by authenticated"
  ON public.user_moderation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mods insert mod status"
  ON public.user_moderation FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "Mods update mod status"
  ON public.user_moderation FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER user_moderation_touch
  BEFORE UPDATE ON public.user_moderation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill existing profiles
INSERT INTO public.user_moderation (user_id, status)
SELECT id, 'active' FROM public.profiles
ON CONFLICT DO NOTHING;

-- Auto-create on new profile
CREATE OR REPLACE FUNCTION public.create_default_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_moderation (user_id, status) VALUES (NEW.id, 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER profiles_default_moderation
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_moderation();