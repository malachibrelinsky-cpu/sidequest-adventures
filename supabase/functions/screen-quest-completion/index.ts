// Quan screens quest completion evidence and awards points to all participants.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const post_id: string | undefined = body?.post_id;
    const rawEvidenceUrls: string[] = Array.isArray(body?.evidence_urls) ? body.evidence_urls : [];
    if (!post_id) return json({ error: "post_id required" }, 400);
    if (rawEvidenceUrls.length === 0) return json({ error: "Add at least one photo or video" }, 400);
    if (rawEvidenceUrls.length > 12) return json({ error: "Too many files (max 12)" }, 400);

    // Only accept URLs that point to this user's own folder in our public storage bucket.
    // This prevents users from passing arbitrary external URLs (or other users' uploads)
    // to game AI screening or persist third-party content in posts.evidence_urls.
    const allowedPrefix = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/post-images/${user.id}/`;
    const evidence_urls: string[] = [];
    for (const u of rawEvidenceUrls) {
      if (typeof u !== "string" || u.length > 1024) {
        return json({ error: "Invalid evidence URL" }, 400);
      }
      let parsed: URL;
      try { parsed = new URL(u); } catch { return json({ error: "Invalid evidence URL" }, 400); }
      if (parsed.protocol !== "https:") return json({ error: "Evidence URL must be https" }, 400);
      // Strip query/hash before prefix-check so cache-busters can't bypass it.
      const normalized = `${parsed.origin}${parsed.pathname}`;
      if (!normalized.startsWith(allowedPrefix)) {
        return json({ error: "Evidence URLs must point to your own uploads in app storage" }, 400);
      }
      evidence_urls.push(normalized);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: post, error: postErr } = await admin
      .from("posts")
      .select("id, user_id, caption, difficulty, points, participants_needed, location, completed_at")
      .eq("id", post_id)
      .maybeSingle();
    if (postErr || !post) return json({ error: "Quest not found" }, 404);
    if (post.user_id !== user.id) return json({ error: "Only the quest poster can mark it complete" }, 403);
    if (!post.difficulty) return json({ error: "Not a sidequest" }, 400);
    if (post.completed_at) return json({ error: "Quest is already completed" }, 400);

    // Participants
    const { data: parts } = await admin
      .from("quest_participants")
      .select("user_id")
      .eq("post_id", post_id);
    const participantIds = (parts ?? []).map((p) => p.user_id);
    if (participantIds.length === 0) return json({ error: "No participants on this quest" }, 400);

    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", participantIds);
    const names = (profs ?? []).map((p) => p.display_name).filter(Boolean);

    // Image-only screening with Quan via Gemini vision. Videos pass through without vision check.
    const imageUrls = evidence_urls.filter((u) => /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)(\?|$)/i.test(u));
    const videoUrls = evidence_urls.filter((u) => !imageUrls.includes(u));

    let approved = true;
    let reason = "Evidence accepted.";

    if (imageUrls.length > 0) {
      const prompt = [
        `You are Quan, a quest verification judge.`,
        `Quest: "${post.caption ?? "Untitled sidequest"}"`,
        post.location ? `Location: ${post.location}` : "",
        `Required participants (${participantIds.length}): ${names.join(", ") || "unknown"}.`,
        `Review the photo evidence and decide if the group genuinely completed this quest together.`,
        `Approve if at least ${Math.max(1, Math.ceil(participantIds.length * 0.7))} distinct people are visible together AND the scene is plausibly the described quest.`,
        `Reject only if the photos are clearly unrelated, fake/AI-looking, contain inappropriate content, or show fewer than that many people together.`,
        `Respond with strict JSON: {"approved": boolean, "reason": string}. Keep "reason" under 200 characters.`,
      ].filter(Boolean).join("\n");

      const content: any[] = [{ type: "text", text: prompt }];
      for (const url of imageUrls.slice(0, 6)) {
        content.push({ type: "image_url", image_url: { url } });
      }

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
      });

      if (aiRes.status === 429) return json({ error: "Quan is busy, try again in a minute." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable Cloud." }, 402);
      if (!aiRes.ok) {
        const text = await aiRes.text();
        console.error("AI gateway error", aiRes.status, text);
        return json({ error: "Quan failed to review the evidence" }, 502);
      }

      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(raw);
        approved = !!parsed.approved;
        reason = String(parsed.reason ?? (approved ? "Approved." : "Rejected.")).slice(0, 240);
      } catch {
        approved = false;
        reason = "Could not parse Quan's verdict.";
      }
    } else if (videoUrls.length > 0) {
      reason = "Video evidence accepted (Quan reviews stills only — please include a photo for stricter screening).";
    }

    if (!approved) {
      return json({ approved: false, reason }, 200);
    }

    // Mark completed and award each participant
    const { error: upErr } = await admin
      .from("posts")
      .update({ completed_at: new Date().toISOString(), evidence_urls })
      .eq("id", post_id);
    if (upErr) {
      console.error("post update failed", upErr);
      return json({ error: "Could not mark quest complete" }, 500);
    }

    const title = (post.caption ?? "Sidequest").slice(0, 120);
    const rows = participantIds.map((uid) => ({
      user_id: uid,
      post_id,
      title,
      difficulty: post.difficulty,
      points: post.points ?? 0,
      notes: reason,
    }));
    const { error: cErr } = await admin.from("quest_completions").insert(rows);
    if (cErr) {
      console.error("completion insert failed", cErr);
      return json({ error: "Quest marked complete but awarding failed" }, 500);
    }

    return json({
      approved: true,
      reason,
      awarded: participantIds.length,
      points: post.points ?? 0,
    }, 200);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
