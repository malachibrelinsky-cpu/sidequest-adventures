import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "Messages — SideQuest" }] }),
  component: InboxPage,
});

type Thread = { otherId: string; lastBody: string; lastAt: string; profile: { id: string; display_name: string; avatar_url: string | null; city: string | null } | null };

function InboxPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: msgs } = await supabase.from("messages")
        .select("sender_id, recipient_id, body, created_at")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const byOther = new Map<string, { body: string; at: string }>();
      (msgs ?? []).forEach((m: any) => {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (!byOther.has(other)) byOther.set(other, { body: m.body, at: m.created_at });
      });
      const ids = Array.from(byOther.keys());
      let profiles: any[] = [];
      if (ids.length) {
        const { data } = await supabase.from("profiles")
          .select("id, display_name, avatar_url, city").in("id", ids);
        profiles = data ?? [];
      }
      setThreads(Array.from(byOther.entries()).map(([otherId, v]) => ({
        otherId, lastBody: v.body, lastAt: v.at,
        profile: profiles.find((p) => p.id === otherId) ?? null,
      })));
    })();
  }, [user]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-primary font-semibold text-sm mb-2">INBOX</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-8">Your chats</h1>
        {threads.length === 0 ? (
          <div className="bento-card p-10 text-center">
            <MessageCircle className="size-10 text-primary mx-auto mb-3" />
            <p className="font-semibold mb-1">No chats yet</p>
            <p className="text-sm text-muted-foreground mb-5">Find someone on the map and send the first message.</p>
            <Link to="/map" className="inline-block rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition">
              Open the map
            </Link>
          </div>
        ) : (
          <div className="bento-card divide-y divide-border">
            {threads.map((t) => (
              <Link key={t.otherId} to="/messages/$userId" params={{ userId: t.otherId }}
                className="flex items-center gap-3 p-4 hover:bg-muted/30 transition">
                <div className="size-12 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold overflow-hidden">
                  {t.profile?.avatar_url ? <img src={t.profile.avatar_url} alt="" className="w-full h-full object-cover"/> : t.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.profile?.display_name ?? "Quester"}</p>
                  <p className="text-sm text-muted-foreground truncate">{t.lastBody}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(t.lastAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
