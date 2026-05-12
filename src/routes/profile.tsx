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
  const [mapColor, setMapColor] = useState<string>("#2dd4a8");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,bio,city,interests,avatar_url,map_color").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          bio: data.bio ?? "",
          city: data.city ?? "",
          interests: (data.interests ?? []).join(", "),
        });
        setAvatarUrl(data.avatar_url);
        if ((data as { map_color?: string }).map_color) setMapColor((data as { map_color: string }).map_color);
      }
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!/^#[0-9a-f]{6}$/i.test(mapColor)) { toast.error("Pick a valid map color"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio || null,
      city: parsed.data.city || null,
      interests: parsed.data.interests ? parsed.data.interests.split(",").map(s => s.trim()).filter(Boolean) : [],
      map_color: mapColor.toLowerCase(),
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved!");
  };

  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  const onPickFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setEditorSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatarBlob = async (blob: Blob) => {
    if (!user) return;
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    setEditorSrc(null);
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
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }} />
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

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Map circle color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={mapColor} onChange={(e) => setMapColor(e.target.value)}
                className="size-12 rounded-xl bg-input/40 border border-border cursor-pointer" />
              <div className="flex flex-wrap gap-2">
                {["#2dd4a8", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#eab308", "#ef4444", "#ffffff"].map((c) => (
                  <button key={c} type="button" onClick={() => setMapColor(c)}
                    aria-label={`Pick ${c}`}
                    className={`size-8 rounded-full border-2 transition ${mapColor.toLowerCase() === c ? "border-foreground scale-110" : "border-border"}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>Preview</span>
                <span className="size-8 rounded-full" style={{ background: mapColor, opacity: 0.4, border: `2px solid ${mapColor}` }} />
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>

        <BadgesPanel userId={user.id} />
      </main>
      <SiteFooter />
      {editorSrc && (
        <AvatarEditor
          src={editorSrc}
          onCancel={() => setEditorSrc(null)}
          onSave={uploadAvatarBlob}
        />
      )}
    </div>
  );
}

function AvatarEditor({ src, onCancel, onSave }: { src: string; onCancel: () => void; onSave: (blob: Blob) => void | Promise<void> }) {
  const SIZE = 280;
  const OUTPUT = 512;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      setImg(i);
      const base = Math.max(SIZE / i.width, SIZE / i.height);
      setZoom(base);
      setOffset({ x: 0, y: 0 });
    };
    i.src = src;
  }, [src]);

  const drawSize = img ? { w: img.width * zoom, h: img.height * zoom } : { w: 0, h: 0 };

  const clampOffset = (o: { x: number; y: number }) => {
    const maxX = Math.max(0, (drawSize.w - SIZE) / 2);
    const maxY = Math.max(0, (drawSize.h - SIZE) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setOffset(clampOffset({ x: e.clientX - drag.x, y: e.clientY - drag.y }));
  };
  const onPointerUp = () => setDrag(null);

  const handleSave = async () => {
    if (!img) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    const scale = OUTPUT / SIZE;
    const w = drawSize.w * scale;
    const h = drawSize.h * scale;
    const cx = OUTPUT / 2 + offset.x * scale;
    const cy = OUTPUT / 2 + offset.y * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    canvas.toBlob(async (blob) => {
      if (blob) await onSave(blob);
      setBusy(false);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bento-card p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold">Adjust your photo</h3>
        <div
          className="relative mx-auto overflow-hidden rounded-full bg-input/40 select-none touch-none"
          style={{ width: SIZE, height: SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                width: drawSize.w,
                height: drawSize.h,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zoom</label>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={img ? zoom / Math.max(SIZE / img.width, SIZE / img.height) : 1}
            onChange={(e) => {
              if (!img) return;
              const base = Math.max(SIZE / img.width, SIZE / img.height);
              const nextZoom = base * parseFloat(e.target.value);
              setZoom(nextZoom);
              const newDraw = { w: img.width * nextZoom, h: img.height * nextZoom };
              const maxX = Math.max(0, (newDraw.w - SIZE) / 2);
              const maxY = Math.max(0, (newDraw.h - SIZE) / 2);
              setOffset((o) => ({ x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) }));
            }}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Drag the photo to reposition.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-border py-2.5 font-semibold hover:bg-input/40 transition">Cancel</button>
          <button onClick={handleSave} disabled={busy || !img}
            className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-semibold disabled:opacity-50 hover:opacity-90 transition">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
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
