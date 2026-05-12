REVOKE SELECT ON public.subscribers FROM authenticated, anon, PUBLIC;
GRANT SELECT (
  id, user_id, plan, is_premium, current_period_end,
  last_streak_revive_at, created_at, updated_at
) ON public.subscribers TO authenticated;