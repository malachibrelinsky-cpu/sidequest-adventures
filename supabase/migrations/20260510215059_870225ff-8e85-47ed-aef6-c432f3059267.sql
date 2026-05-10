
REVOKE EXECUTE ON FUNCTION public.is_leaderboard_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_leaderboard_member(UUID, UUID) TO authenticated;
