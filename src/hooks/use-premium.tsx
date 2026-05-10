import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function usePremium() {
  const { user, loading } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setIsPremium(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscribers")
        .select("is_premium")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setIsPremium(!!data?.is_premium);
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  return { isPremium: isPremium ?? false, loading: loading || isPremium === null };
}
