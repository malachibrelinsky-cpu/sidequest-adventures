import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { z } from "zod";
import { computeBadges, computeStreak, bestEverStreak, flatBadges, formatCountdown, type CompletionRow, type Badge } from "@/lib/streaks";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — SideQuest" }] }),
  component: ProfilePage,
});

const schema = z.object({
  display_name: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  interests: z.string().trim().max(200).optional(),
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", bio: "", city: "", interests: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          bio: data.bio ?? "",
          city: data.city ?? "",
          interests: (data.interests ?? []).join(", "),
        });
        setAvatarUrl(data.avatar_url);
      }
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio || null,
      city: parsed.data.city || null,
      interests: parsed.data.interests ? parsed.data.interests.split(",").map(s => s.trim()).filter(Boolean) : [],
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved!");
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setAvatarUrl(data.publicUrl);
    toast.success("Avatar updated");
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-4xl font-bold mb-8">My profile</h1>
        <div className="bento-card p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="size-20 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold text-2xl overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (form.display_name[0]?.toUpperCase() ?? "?")}
            </div>
            <label className="text-sm text-primary cursor-pointer hover:underline">
              Change avatar
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
          </div>

          {([
            ["display_name", "Display name", false],
            ["city", "City / neighborhood", false],
            ["interests", "Interests (comma-separated)", false],
            ["bio", "Bio", true],
          ] as const).map(([k, label, area]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
              {area ? (
                <textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={3} maxLength={300}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 outline-none focus:border-primary resize-none" />
              ) : (
                <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} maxLength={200}
                  className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 outline-none focus:border-primary" />
              )}
            </div>
          ))}

          <button onClick={save} disabled={saving}
            className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>

        <BadgesPanel userId={user.id} />
      </main>
      <SiteFooter />
    </div>
  );
}

function BadgesPanel({ userId }: { userId: string }) {
  const [comps, setComps] = useState<CompletionRow[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    supabase.from("quest_completions")
      .select("created_at, difficulty, points")
      .eq("user_id", userId)
      .then(({ data }) => { if (alive) setComps((data ?? []) as CompletionRow[]); });
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { alive = false; clearInterval(tick); };
  }, [userId]);

  if (!comps) return null;
  const total = comps.reduce((s, c) => s + (c.points ?? 0), 0);
  const streak = computeStreak(comps, now);
  const best = bestEverStreak(comps);
  const badges = computeBadges({ totalPoints: total, completions: comps, bestStreak: best });
  const all: Badge[] = flatBadges(badges);

  return (
    <div className="bento-card p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">Achievements</h2>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-input/30 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Points</p>
          <p className="text-xl font-bold text-primary">{total.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-input/30 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quests</p>
          <p className="text-xl font-bold">{comps.length}</p>
        </div>
        <div className="rounded-xl bg-input/30 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 justify-center"><Flame className="size-3 text-orange-400" /> Streak</p>
          <p className="text-xl font-bold text-orange-400">{streak.alive ? streak.count : 0}</p>
          {streak.alive && <p className="text-[10px] font-mono text-muted-foreground">{formatCountdown(streak.msRemaining)}</p>}
        </div>
      </div>

      {badges.rank && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="text-3xl">{badges.rank.emoji}</div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Current rank</p>
            <p className="font-bold text-lg">{badges.rank.label}</p>
            <p className="text-xs text-muted-foreground">{badges.rank.description}</p>
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <p className="text-sm text-muted-foreground">Complete quests to earn badges and ranks.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {all.map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-input/20 p-3 flex items-center gap-2" title={b.description}>
              <span className="text-2xl">{b.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{b.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
