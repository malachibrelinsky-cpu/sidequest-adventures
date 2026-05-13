-- Lock down sensitive profile columns from broad authenticated reads.
-- Owner access flows through SECURITY DEFINER RPCs (e.g. get_my_profile_phone).
REVOKE SELECT (phone_e164, phone_hash, discoverable_by_contacts, contacts_synced_at)
  ON public.profiles FROM authenticated, anon;

-- Hide free-text quest completion notes from other users.
REVOKE SELECT (notes) ON public.quest_completions FROM authenticated, anon;

-- Owner-only RPC to read own quest completion notes if ever needed.
CREATE OR REPLACE FUNCTION public.get_my_quest_completion_notes(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT notes FROM public.quest_completions
  WHERE id = p_id AND user_id = auth.uid();
$$;