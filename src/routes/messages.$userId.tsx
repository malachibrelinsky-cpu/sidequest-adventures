import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Send, ArrowLeft, Paperclip } from "lucide-react";
import { uploadChatMedia, detectChatMedia } from "@/lib/chat-media";
import { VideoWithWatermark } from "@/components/VideoWithWatermark";

export const Route = createFileRoute("/messages/$userId")({
  head: () => ({ meta: [{ title: "Chat — SideQuest" }] }),
  component: ChatPage,
});

type Profile = { id: string; display_name: string; avatar_url: string | null; city: string | null };
type Msg = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };

function ChatPage() {
  const { userId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles")
        .select("id, display_name, avatar_url, city").eq("id", userId).maybeSingle();
      setOther(p as Profile | null);

      const { data: m } = await supabase.from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setMessages((m ?? []) as Msg[]);
    })();

    const channel = supabase
      .channel(`chat:${user.id}:${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Msg;
          if (
            (msg.sender_id === user.id && msg.recipient_id === userId) ||
            (msg.sender_id === userId && msg.recipient_id === user.id)
          ) {
            setMessages((prev) => prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, userId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id, recipient_id: userId, body,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || uploading) return;
    setUploading(true);
    try {
      const url = await uploadChatMedia(file, user.id);
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id, recipient_id: userId, body: url,
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-6 flex-1 flex flex-col">
        <Link to="/messages" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="size-4" /> All chats
        </Link>
        <div className="bento-card flex-1 flex flex-col overflow-hidden min-h-[60vh]">
          <header className="flex items-center gap-3 p-4 border-b border-border">
            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold overflow-hidden">
              {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover"/> : other?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{other?.display_name ?? "Quester"}</p>
              {other?.city && <p className="text-xs text-muted-foreground truncate">{other.city}</p>}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Say hi — pitch a quest, suggest a time.</p>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === user.id;
              const media = detectChatMedia(m.body);
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {media ? (
                    <div className={`max-w-[75%] overflow-hidden rounded-2xl ${mine ? "rounded-br-sm" : "rounded-bl-sm"} bg-muted/30`}>
                      {media.kind === "image" ? (
                        <a href={media.url} target="_blank" rel="noreferrer">
                          <img src={media.url} alt="" className="max-h-80 w-full object-cover" />
                        </a>
                      ) : (
                        <VideoWithWatermark src={media.url} className="max-h-80 w-full" />
                      )}
                    </div>
                  ) : (
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${mine
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm"
                      : "bg-muted/50 text-foreground rounded-bl-sm"}`}>
                      {m.body}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="border-t border-border p-3 flex gap-2 items-center">
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              title="Send photo or video"
              className="size-10 rounded-full bg-muted/30 hover:bg-muted/60 grid place-items-center disabled:opacity-50 transition shrink-0">
              <Paperclip className="size-4" />
            </button>
            <input
              value={text} onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={uploading ? "Uploading…" : "Type a message…"}
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
