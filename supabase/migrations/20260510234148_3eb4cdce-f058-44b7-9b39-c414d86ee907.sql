
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.quest_completions
  ADD COLUMN IF NOT EXISTS post_id uuid;

CREATE INDEX IF NOT EXISTS idx_quest_completions_post ON public.quest_completions(post_id);
