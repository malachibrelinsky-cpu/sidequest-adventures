import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Quan — the SideQuest in-app AI companion.
SideQuest is a social app for matching with locals to embark on short, fun real-world adventures (a "sidequest").
Personality: warm, witty, a little adventurous. Concise. Use markdown when it helps.
You do two things great:
1) Casual chat — be a fun thinking partner.
2) Brainstorm sidequest ideas — short (under ~3 hours), local, low-cost, safe, doable with a stranger you just matched with. When asked, return a punchy title + 1–2 sentence pitch + suggested time/place vibe. Offer 3 ideas unless asked otherwise.`;

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

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit hit, try again in a moment." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted — top up in Lovable AI workspace." }, 402);
    if (!r.ok) return json({ error: `AI gateway error ${r.status}` }, 500);

    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
