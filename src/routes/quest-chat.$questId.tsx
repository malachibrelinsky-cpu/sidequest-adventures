import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Send, ArrowLeft, Trophy, Users, MapPin, Clock, Paperclip } from "lucide-react";
import { uploadChatMedia, detectChatMedia } from "@/lib/chat-media";

export const Route = createFileRoute("/quest-chat/$questId")({
  head: () => ({ meta: [{ title: "Quest chat — SideQuest" }] }),
  component: QuestChatPage,
});

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Msg = { id: string; user_id: string; body: string; created_at: string };
type Post = {
  id: string; caption: string | null; user_id: string;
  difficulty: string | null; points: number | null;
  participants_needed: number | null; quest_time: string | null; location: string | null;
};

function QuestChatPage() {
  const { questId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("posts")
        .select("id, caption, user_id, difficulty, points, participants_needed, quest_time, location")
        .eq("id", questId).maybeSingle();
      setPost(p as Post | null);

      const { data: parts } = await supabase.from("quest_participants")
        .select("user_id, profiles!quest_participants_user_id_fkey(id, display_name, avatar_url)")
        .eq("post_id", questId);
      // Fallback if FK alias doesn't resolve, fetch profiles directly
      let profs: Profile[] = [];
      if (parts && parts.length > 0) {
        const ids = parts.map((r: any) => r.user_id);
        const { data: pr } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        profs = (pr ?? []) as Profile[];
      }
      setParticipants(profs);
      const map: Record<string, Profile> = {};
      profs.forEach((pr) => { map[pr.id] = pr; });
      setProfileMap(map);

      const { data: m } = await supabase.from("quest_messages")
        .select("id, user_id, body, created_at")
        .eq("post_id", questId).order("created_at", { ascending: true });
      setMessages((m ?? []) as Msg[]);
    })();

    const channel = supabase
      .channel(`quest-chat:${questId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "quest_messages", filter: `post_id=eq.${questId}` },
        (payload) => {
          const msg = payload.new as Msg;
          setMessages((prev) => prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, questId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("quest_messages").insert({
      post_id: questId, user_id: user.id, body,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); }
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-6 flex-1 flex flex-col">
        <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="bento-card flex-1 flex flex-col overflow-hidden min-h-[60vh]">
          <header className="p-4 border-b border-border space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground">
                <Trophy className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{post?.caption || "Sidequest"}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                  {post?.points != null && <span>{post.points} pts · {post.difficulty}</span>}
                  {post?.participants_needed != null && (
                    <span className="inline-flex items-center gap-1"><Users className="size-3" />{participants.length}/{post.participants_needed}</span>
                  )}
                  {post?.quest_time && (
                    <span className="inline-flex items-center gap-1"><Clock className="size-3" />{new Date(post.quest_time).toLocaleString()}</span>
                  )}
                  {post?.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{post.location}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((pr) => (
                <div key={pr.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 pr-3 pl-1 py-1 text-xs">
                  {pr.avatar_url
                    ? <img src={pr.avatar_url} alt="" className="size-5 rounded-full object-cover" />
                    : <div className="size-5 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground text-[10px] font-bold">{pr.display_name?.[0]?.toUpperCase() ?? "?"}</div>}
                  <span className="font-medium">{pr.display_name}</span>
                </div>
              ))}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Group chat is empty — say hi to your quest crew.</p>
            )}
            {messages.map((m) => {
              const mine = m.user_id === user.id;
              const author = profileMap[m.user_id];
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && (
                    author?.avatar_url
                      ? <img src={author.avatar_url} alt="" className="size-7 rounded-full object-cover shrink-0" />
                      : <div className="size-7 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground text-xs font-bold shrink-0">{author?.display_name?.[0]?.toUpperCase() ?? "?"}</div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm"
                    : "bg-muted/50 text-foreground rounded-bl-sm"}`}>
                    {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{author?.display_name ?? "Quester"}</p>}
                    {m.body}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
            <input
              value={text} onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Message the crew…"
              className="flex-1 bg-muted/30 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-sm"
            />
            <button type="submit" disabled={!text.trim() || sending}
              className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
