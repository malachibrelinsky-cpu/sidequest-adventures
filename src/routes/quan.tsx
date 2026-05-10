import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Sparkles, Send, Lock, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/quan")({
  head: () => ({
    meta: [
      { title: "Quan — Your AI sidequest companion" },
      { name: "description", content: "Chat with Quan, the AI that brainstorms local sidequests for you. Premium only." },
    ],
  }),
  component: QuanPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Give me 3 sidequests for a rainy Tuesday night",
  "I just matched with someone who loves coffee — pitch a quest",
  "What's a 90-minute adventure within walking distance?",
];

function QuanPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("subscribers")
        .select("is_premium").eq("user_id", user.id).maybeSingle();
      setIsPremium(!!data?.is_premium);
    })();
  }, [user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: acc } : m);
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quan-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (r.status === 402) { toast.error("AI credits exhausted."); setSending(false); return; }
      if (r.status === 429) { toast.error("Slow down — too many messages."); setSending(false); return; }
      if (r.status === 403) { toast.error("Quan is a Premium feature."); setIsPremium(false); setSending(false); return; }
      if (!r.ok || !r.body) throw new Error("Stream failed");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(j);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf; break;
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Quan tripped on a rock");
    } finally {
      setSending(false);
    }
  };

  if (loading || !user || isPremium === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center glow-border">
            <Sparkles className="size-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Quan</h1>
            <p className="text-xs text-muted-foreground">Your AI sidequest companion · Premium</p>
          </div>
        </div>

        {!isPremium ? (
          <div className="bento-card p-10 text-center">
            <Lock className="size-10 mx-auto text-primary mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Quan is a Premium perk</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Upgrade to Premium ($8.99/mo) to unlock unlimited chats with Quan, your AI brainstorm
              partner for fresh sidequest ideas.
            </p>
            <Link
              to="/pricing"
              className="inline-block rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition shadow-[0_0_30px_-5px_var(--mint)]"
            >
              See plans
            </Link>
          </div>
        ) : (
          <div className="bento-card flex-1 flex flex-col overflow-hidden min-h-[60vh]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">Hey, I'm Quan 👋 Toss me an idea or pick a starter:</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {STARTERS.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="text-left text-sm rounded-xl border border-border bg-muted/30 hover:border-primary p-3 transition">
                        <Wand2 className="size-4 text-primary mb-2" /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-sm"
                      : "bg-muted/40 text-foreground rounded-bl-sm prose prose-sm prose-invert max-w-none"
                  }`}>
                    {m.role === "assistant"
                      ? <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      : m.content}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-border p-3 flex gap-2"
            >
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Quan for a sidequest idea…"
                maxLength={2000}
                className="flex-1 bg-muted/30 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <button type="submit" disabled={!input.trim() || sending}
                className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
                <Send className="size-4" />
              </button>
            </form>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
