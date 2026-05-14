import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Quan — the resident AI of SideQuest, a social app where locals match up to do short, real-world adventures ("sidequests").

Your role: you basically run the vibes of this app. Think part hype-friend, part community manager, part creative director. You help users brainstorm sidequests, hype up their wins, mediate ideas, and keep the culture alive.

Voice & tone (CRITICAL — you talk like Gen Z, not a corporate brand):
- Casual, lowercase-friendly, dry humor, a little chaotic in a good way.
- Use slang naturally when it fits: "lowkey", "fr", "no cap", "bet", "slay", "it's giving ___", "the way that…", "rent free", "ate", "we love to see it", "main character energy", "delulu", "iykyk", "ngl". Don't force every one in every reply — sprinkle.
- Never sound like a chatbot disclaimer ("As an AI…"). Never lecture.
- Be hype but not cringe. If something's mid, you can say so kindly.
- Emojis: sparingly. One or two max, only if they actually add something.
- Markdown is fine but keep replies tight. Bullet lists when listing quests.

What you do:
1) Banter & vibe-check casually.
2) Brainstorm sidequest ideas — short (under ~3 hours), local, low-cost, safe, doable with someone you just matched with. Default to 3 ideas: punchy title + 1–2 sentence pitch + suggested time/place vibe.
3) Reference the live app context provided to you (recent posts, top questers, the user's own past chats with you). Use it to make ideas feel current, personal, and tied to what's actually trending in the community. Don't quote it verbatim — riff on it.
4) When a user says something happened to them, react like a friend would, then offer a follow-up quest if it fits.

Boundaries: keep things safe, legal, consent-forward. No quests that involve harassing strangers, trespassing, or anything sketchy.`;

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 4000;

function sanitizeMessages(input: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(input)) return [];
  const cleaned: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.slice(0, MAX_CONTENT_CHARS);
    if (!trimmed.trim()) continue;
    cleaned.push({ role, content: trimmed });
  }
  return cleaned.slice(-MAX_MESSAGES);
}

async function buildLearningContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const [postsRes, leadersRes, pastRes] = await Promise.all([
    supabase
      .from("posts")
      .select("caption, difficulty, points, location, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("quest_completions")
      .select("title, difficulty, points, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("quan_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const posts = (postsRes.data ?? []) as Array<{ caption: string | null; difficulty: string | null; points: number | null; location: string | null }>;
  const completions = (leadersRes.data ?? []) as Array<{ title: string; difficulty: string; points: number; user_id: string }>;
  const past = ((pastRes.data ?? []) as Array<{ role: string; content: string }>).reverse();

  // Aggregate top questers by points
  const tally = new Map<string, number>();
  for (const c of completions) tally.set(c.user_id, (tally.get(c.user_id) ?? 0) + (c.points ?? 0));
  const topRanks = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, pts], i) => `#${i + 1} user ${uid.slice(0, 6)} — ${pts} pts`)
    .join("\n");

  const recentPosts = posts
    .filter((p) => p.caption)
    .slice(0, 10)
    .map((p) => `- ${p.difficulty ? `[${p.difficulty}] ` : ""}${(p.caption ?? "").slice(0, 140)}${p.location ? ` (@ ${p.location})` : ""}`)
    .join("\n");

  const recentCompletions = completions
    .slice(0, 8)
    .map((c) => `- "${c.title}" (${c.difficulty}, +${c.points})`)
    .join("\n");

  const pastChat = past
    .map((m) => `${m.role}: ${m.content.slice(0, 240)}`)
    .join("\n");

  return [
    "=== LIVE APP CONTEXT (use to make replies feel current; don't recite verbatim) ===",
    recentPosts ? `Recent community posts:\n${recentPosts}` : "Recent community posts: (none yet)",
    recentCompletions ? `\nRecent quest completions:\n${recentCompletions}` : "",
    topRanks ? `\nTop questers right now:\n${topRanks}` : "",
    pastChat ? `\nThis user's past chats with you (oldest → newest):\n${pastChat}` : "",
    "=== END CONTEXT ===",
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: sub } = await supabase
      .from("subscribers").select("is_premium").eq("user_id", user.id).maybeSingle();
    if (!sub?.is_premium) return json({ error: "Quan is a Premium feature." }, 403);

    const body = await req.json().catch(() => ({}));
    const messages = sanitizeMessages((body as { messages?: unknown }).messages);
    if (!messages.length) return json({ error: "No valid messages provided" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    // Persist the latest user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await supabase.from("quan_messages").insert({
        user_id: user.id, role: "user", content: lastUser.content,
      });
    }

    const learningContext = await buildLearningContext(supabase, user.id);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: learningContext },
          ...messages,
        ],
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit hit, try again in a moment." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted — top up in Lovable AI workspace." }, 402);
    if (!r.ok || !r.body) return json({ error: `AI gateway error ${r.status}` }, 500);

    // Tee the stream: forward to client AND collect for persistence.
    const [toClient, toCollect] = r.body.tee();
    (async () => {
      try {
        const reader = toCollect.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let assistant = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") continue;
            try {
              const c = JSON.parse(j).choices?.[0]?.delta?.content;
              if (c) assistant += c;
            } catch { /* partial */ }
          }
        }
        if (assistant.trim()) {
          await supabase.from("quan_messages").insert({
            user_id: user.id, role: "assistant", content: assistant.slice(0, 8000),
          });
        }
      } catch (e) {
        console.error("quan persist error:", e);
      }
    })();

    return new Response(toClient, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
