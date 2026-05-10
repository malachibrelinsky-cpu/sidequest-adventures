import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Heart, MessageCircle, Image as ImageIcon, Send, Trophy, Pencil, Trash2, Check, X, RotateCw, RotateCcw, Crop as CropIcon, ZoomIn, ZoomOut, Users, MapPin, Clock } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed — SideQuest" }, { name: "description", content: "See photos from member adventures and share your own." }] }),
  component: FeedPage,
});

const DIFFICULTIES = ["easy", "medium", "hard", "epic"] as const;
type Difficulty = typeof DIFFICULTIES[number];
const DIFFICULTY_DEFAULTS: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 60, epic: 150 };
const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  hard: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  epic: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
};

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Comment = { id: string; body: string; created_at: string; user_id: string; profiles: Profile | null };
type Post = { id: string; caption: string | null; image_urls: string[]; created_at: string; user_id: string; difficulty: Difficulty | null; points: number | null; participants_needed: number | null; quest_time: string | null; location: string | null; profiles: Profile | null; comments: Comment[]; quest_participants: { user_id: string }[] };

const captionSchema = z.string().trim().max(150);
const commentSchema = z.string().trim().min(1).max(1000);

async function rotateImageFile(file: File, degrees: number): Promise<File> {
  const deg = ((degrees % 360) + 360) % 360;
  if (deg === 0) return file;
  // Skip rasterization for SVG — keep original
  if (file.type === "image/svg+xml") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image for rotation"));
      el.src = url;
    });
    const swap = deg === 90 || deg === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.naturalHeight : img.naturalWidth;
    canvas.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rotation failed"))), outType, 0.92)
    );
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = outType === "image/png" ? "png" : "jpg";
    return new File([blob], `${baseName}.${ext}`, { type: outType });
  } finally {
    URL.revokeObjectURL(url);
  }
}
const pointsSchema = z.number().int().min(0).max(150);

type Tab = "all" | "quests" | "updates";

function FeedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image_urls, created_at, user_id, difficulty, points, participants_needed, quest_time, location, profiles!posts_user_id_fkey(id, display_name, avatar_url), comments(id, body, created_at, user_id, profiles!comments_user_id_fkey(id, display_name, avatar_url)), quest_participants(user_id)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); return; }
    setPosts((data as unknown as Post[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  const filtered = tab === "all" ? posts : tab === "quests" ? posts.filter((p) => p.difficulty) : posts.filter((p) => !p.difficulty);
  const counts = { all: posts.length, quests: posts.filter((p) => p.difficulty).length, updates: posts.filter((p) => !p.difficulty).length };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">Quests & Feed</h1>
          <p className="text-muted-foreground">Joinable sidequests and photos from adventures around you.</p>
        </div>

        <ComposePost onPosted={load} />

        <div className="flex gap-1 border-b border-border mt-8 mb-4">
          {(["all", "quests", "updates"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "quests" ? "🎯 Sidequests" : t === "updates" ? "📸 Updates" : "All"}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>

        {fetching ? (
          <p className="text-muted-foreground text-center py-12">Loading posts…</p>
        ) : filtered.length === 0 ? (
          <div className="bento-card p-10 text-center mt-6">
            <p className="text-muted-foreground">
              {tab === "quests" ? "No joinable sidequests yet — post one with the trophy toggle above." :
               tab === "updates" ? "No photo updates yet." :
               "No posts yet. Be the first to share a side quest."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((p) => <PostCard key={p.id} post={p} onChange={load} currentUserId={user.id} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ComposePost({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rotations, setRotations] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isQuest, setIsQuest] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [points, setPoints] = useState<string>("25");
  const [participantsNeeded, setParticipantsNeeded] = useState<string>("4");
  const [questTime, setQuestTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  const applyCrop = async (i: number, croppedFile: File) => {
    setFiles((fs) => fs.map((f, idx) => (idx === i ? croppedFile : f)));
    setRotations((rs) => rs.map((r, idx) => (idx === i ? 0 : r)));
    setCropIndex(null);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, 4);
    setFiles(picked);
    setRotations(picked.map(() => 0));
  };

  const rotate = (i: number, dir: 1 | -1) => {
    setRotations((rs) => rs.map((r, idx) => (idx === i ? (((r + dir * 90) % 360) + 360) % 360 : r)));
  };

  const removeFile = (i: number) => {
    setFiles((fs) => fs.filter((_, idx) => idx !== i));
    setRotations((rs) => rs.filter((_, idx) => idx !== i));
  };

  const pickDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setPoints(String(DIFFICULTY_DEFAULTS[d]));
  };

  const submit = async () => {
    if (!user) return;
    if (!isQuest && files.length === 0) { toast.error("Add at least one photo"); return; }
    const cap = captionSchema.safeParse(caption);
    if (!cap.success) { toast.error("Caption too long"); return; }
    let questFields: { difficulty: Difficulty; points: number; participants_needed: number; quest_time: string; location: string } | null = null;
    if (isQuest) {
      const parsed = pointsSchema.safeParse(Number(points));
      if (!parsed.success) { toast.error("Points must be a whole number from 0 to 150"); return; }
      const pn = Number(participantsNeeded);
      if (!Number.isInteger(pn) || pn < 1 || pn > 50) { toast.error("Participants must be 1–50"); return; }
      if (!questTime) { toast.error("Pick a time for the quest"); return; }
      const loc = location.trim();
      if (!loc) { toast.error("Add a location"); return; }
      questFields = { difficulty, points: parsed.data, participants_needed: pn, quest_time: new Date(questTime).toISOString(), location: loc };
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const rot = rotations[i] ?? 0;
        const toUpload = rot === 0 ? f : await rotateImageFile(f, rot);
        const ext = (toUpload.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, toUpload, { contentType: toUpload.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("post-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        caption: caption.trim() || null,
        image_urls: urls,
        difficulty: questFields?.difficulty ?? null,
        points: questFields?.points ?? null,
        participants_needed: questFields?.participants_needed ?? null,
        quest_time: questFields?.quest_time ?? null,
        location: questFields?.location ?? null,
      });
      if (error) throw error;
      setCaption(""); setFiles([]); setRotations([]); setIsQuest(false); setDifficulty("medium"); setPoints("25");
      setParticipantsNeeded("4"); setQuestTime(""); setLocation("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Posted!");
      onPosted();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="bento-card p-5">
      <textarea
        value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500}
        placeholder="What was the side quest tonight?"
        className="w-full bg-transparent resize-none outline-none placeholder:text-muted-foreground"
        rows={2}
      />
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted/30 group">
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="w-full h-full object-cover transition-transform duration-200"
                style={{ transform: `rotate(${rotations[i] ?? 0}deg)` }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                <button type="button" onClick={() => rotate(i, -1)} title="Rotate left"
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                  <RotateCcw className="size-3.5" />
                </button>
                <button type="button" onClick={() => rotate(i, 1)} title="Rotate right"
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                  <RotateCw className="size-3.5" />
                </button>
                <button type="button" onClick={() => setCropIndex(i)} title="Crop & zoom"
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                  <CropIcon className="size-3.5" />
                </button>
                <button type="button" onClick={() => removeFile(i)} title="Remove"
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cropIndex !== null && files[cropIndex] && (
        <CropModal
          file={files[cropIndex]}
          rotation={rotations[cropIndex] ?? 0}
          onCancel={() => setCropIndex(null)}
          onApply={(out) => applyCrop(cropIndex, out)}
        />
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={isQuest} onChange={(e) => setIsQuest(e.target.checked)}
            className="size-4 rounded border-border accent-primary" />
          <Trophy className="size-4 text-primary" />
          <span className="font-semibold">Post as a sidequest others can join</span>
        </label>

        {isQuest && (
          <div className="mt-3 space-y-3 rounded-xl bg-input/20 border border-border p-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Difficulty</p>
              <div className="grid grid-cols-4 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button key={d} type="button" onClick={() => pickDifficulty(d)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition ${difficulty === d ? `${DIFFICULTY_STYLE[d]}` : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Point worth <span className="opacity-60">(0–150, suggested {DIFFICULTY_DEFAULTS[difficulty]})</span>
              </p>
              <input type="number" min={0} max={150} value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-32 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary cursor-pointer transition">
          <ImageIcon className="size-5" /> Add photos (up to 4)
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.svg" multiple className="hidden" onChange={onPick} />
        </label>
        <button
          onClick={submit} disabled={uploading || files.length === 0}
          className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2 font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition"
        >
          {uploading ? "Posting…" : "Share"}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, onChange, currentUserId }: { post: Post; onChange: () => void; currentUserId: string }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  const profile = post.profiles;
  const isOwner = post.user_id === currentUserId;

  const addComment = async () => {
    const parsed = commentSchema.safeParse(newComment);
    if (!parsed.success) { toast.error("Comment can't be empty"); return; }
    setPosting(true);
    const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: currentUserId, body: parsed.data });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    onChange();
  };

  const saveCaption = async () => {
    const parsed = captionSchema.safeParse(editCaption);
    if (!parsed.success) { toast.error("Caption too long"); return; }
    setSaving(true);
    const { error } = await supabase.from("posts").update({ caption: parsed.data || null }).eq("id", post.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEditing(false);
    toast.success("Updated");
    onChange();
  };

  const deletePost = async () => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onChange();
  };

  return (
    <article className="bento-card overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <Avatar profile={profile} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{profile?.display_name ?? "Quester"}</p>
          <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>
        </div>
        {post.difficulty && (
          <div className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${DIFFICULTY_STYLE[post.difficulty]}`}>
            <Trophy className="size-3.5" />
            {post.difficulty}
            {post.points != null && <span className="opacity-80">· {post.points} pts</span>}
          </div>
        )}
        {isOwner && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setEditCaption(post.caption ?? ""); setEditing(true); }} title="Edit caption"
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <Pencil className="size-4" />
            </button>
            <button onClick={deletePost} title="Delete post"
              className="p-1.5 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition">
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      {post.image_urls.length > 0 && (
        <div className={`grid gap-1 ${post.image_urls.length === 1 ? "" : post.image_urls.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {post.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" loading="lazy" className="w-full aspect-square object-cover" />
          ))}
        </div>
      )}
      {editing ? (
        <div className="px-4 pt-4 space-y-2">
          <textarea
            value={editCaption} onChange={(e) => setEditCaption(e.target.value)} maxLength={150} rows={3}
            className="w-full rounded-2xl bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            placeholder="Write a caption…"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-muted hover:bg-muted/70 transition">
              <X className="size-3.5" /> Cancel
            </button>
            <button onClick={saveCaption} disabled={saving} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition">
              <Check className="size-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        post.caption && <p className="px-4 pt-4 text-sm">{post.caption}</p>
      )}
      <div className="px-4 py-3 flex items-center gap-4 text-sm text-muted-foreground">
        <button className="flex items-center gap-1.5 hover:text-primary transition">
          <Heart className="size-5" />
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 hover:text-primary transition">
          <MessageCircle className="size-5" /> {post.comments.length}
        </button>
      </div>
      {showComments && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {post.comments.length === 0 && <p className="text-xs text-muted-foreground">Be the first to comment.</p>}
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar profile={c.profiles} small />
              <div className="bg-muted/40 rounded-2xl px-3 py-2 text-sm flex-1">
                <p className="font-semibold text-xs">{c.profiles?.display_name ?? "Quester"}</p>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-center pt-2">
            <input
              value={newComment} onChange={(e) => setNewComment(e.target.value)} maxLength={1000}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              placeholder="Add a comment…"
              className="flex-1 rounded-full bg-input/40 border border-border px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button onClick={addComment} disabled={posting} className="rounded-full bg-primary text-primary-foreground p-2 disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Avatar({ profile, small }: { profile: Profile | null; small?: boolean }) {
  const size = small ? "size-7" : "size-10";
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${size} rounded-full object-cover`} />;
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold text-sm`}>
      {(profile?.display_name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function CropModal({ file, rotation, onCancel, onApply }: {
  file: File;
  rotation: number;
  onCancel: () => void;
  onApply: (out: File) => void;
}) {
  const VP = 320;
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const rotated = rotation === 0 ? file : await rotateImageFile(file, rotation);
        if (cancelled) return;
        url = URL.createObjectURL(rotated);
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setBaseFile(rotated);
          setImgUrl(url);
          setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          setZoom(1);
          setOffset({ x: 0, y: 0 });
        };
        img.onerror = () => toast.error("Could not load image");
        img.src = url;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not prepare image");
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, rotation]);

  const baseScale = natural ? Math.max(VP / natural.w, VP / natural.h) : 1;
  const effScale = baseScale * zoom;
  const renderedW = natural ? natural.w * effScale : 0;
  const renderedH = natural ? natural.h * effScale : 0;
  const maxOffX = Math.max(0, (renderedW - VP) / 2);
  const maxOffY = Math.max(0, (renderedH - VP) / 2);

  const clamp = (x: number, y: number) => ({
    x: Math.max(-maxOffX, Math.min(maxOffX, x)),
    y: Math.max(-maxOffY, Math.min(maxOffY, y)),
  });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clamp(dragRef.current.ox + dx, dragRef.current.oy + dy));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const apply = async () => {
    if (!baseFile || !natural || !imgUrl) return;
    setSaving(true);
    try {
      const srcSizePx = VP / effScale;
      const renderedLeft = (VP - renderedW) / 2 + offset.x;
      const renderedTop = (VP - renderedH) / 2 + offset.y;
      const srcX = (-renderedLeft) / effScale;
      const srcY = (-renderedTop) / effScale;

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not load image"));
        el.src = imgUrl;
      });

      const outSize = Math.round(srcSizePx);
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, srcX, srcY, srcSizePx, srcSizePx, 0, 0, outSize, outSize);
      const outType = baseFile.type === "image/png" ? "image/png" : "image/jpeg";
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), outType, 0.92)
      );
      const baseName = baseFile.name.replace(/\.[^.]+$/, "");
      const ext = outType === "image/png" ? "png" : "jpg";
      onApply(new File([blob], `${baseName}-cropped.${ext}`, { type: outType }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not crop");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bento-card p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2"><CropIcon className="size-4" /> Crop & zoom</h2>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div
          className="relative mx-auto overflow-hidden rounded-lg bg-black/40 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ width: VP, height: VP }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgUrl && natural && (
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: renderedW,
                height: renderedH,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                maxWidth: "none",
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/30" />
        </div>
        <div className="flex items-center gap-3 mt-4">
          <ZoomOut className="size-4 text-muted-foreground" />
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={(e) => {
              const z = Number(e.target.value);
              setZoom(z);
              const newBaseScale = natural ? Math.max(VP / natural.w, VP / natural.h) : 1;
              const newEff = newBaseScale * z;
              const newW = natural ? natural.w * newEff : 0;
              const newH = natural ? natural.h * newEff : 0;
              const mx = Math.max(0, (newW - VP) / 2);
              const my = Math.max(0, (newH - VP) / 2);
              setOffset((o) => ({
                x: Math.max(-mx, Math.min(mx, o.x)),
                y: Math.max(-my, Math.min(my, o.y)),
              }));
            }}
            className="flex-1 accent-primary"
          />
          <ZoomIn className="size-4 text-muted-foreground" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold bg-muted hover:bg-muted/70 transition">
            Cancel
          </button>
          <button onClick={apply} disabled={saving || !baseFile} className="rounded-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50 hover:opacity-90 transition">
            {saving ? "Applying…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
