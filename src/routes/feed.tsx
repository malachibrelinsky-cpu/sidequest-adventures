import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Heart, MessageCircle, Image as ImageIcon, Send, Trophy, Pencil, Trash2, Check, X, RotateCw, RotateCcw, Crop as CropIcon, ZoomIn, ZoomOut, Users, MapPin, Clock, Sparkles, CheckCircle2, Upload, Filter, List, Map as MapIcon, AlignStartVertical } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed — SideQuest" }, { name: "description", content: "See photos from member adventures and share your own." }] }),
  component: FeedPage,
});

const DIFFICULTIES = ["common", "rare", "epic", "impossible"] as const;
type Difficulty = typeof DIFFICULTIES[number];
const DIFFICULTY_DEFAULTS: Record<Difficulty, number> = { common: 10, rare: 25, epic: 100, impossible: 150 };
const DIFFICULTY_STYLE: Record<string, string> = {
  common: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rare: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  epic: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  impossible: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  // legacy fallbacks
  easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  hard: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Comment = { id: string; body: string; created_at: string; user_id: string; profiles: Profile | null };
type Post = { id: string; caption: string | null; image_urls: string[]; created_at: string; user_id: string; difficulty: Difficulty | null; points: number | null; participants_needed: number | null; quest_time: string | null; location: string | null; completed_at: string | null; evidence_urls: string[]; profiles: Profile | null; comments: Comment[]; quest_participants: { user_id: string }[] };

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


type Tab = "all" | "quests" | "updates";

type PostWithCoords = Post & { latitude: number | null; longitude: number | null };

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function FeedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isQuestsRoute = location.pathname.startsWith("/quests");
  const [posts, setPosts] = useState<PostWithCoords[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<Tab>(isQuestsRoute ? "quests" : "updates");
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  // Quests-route-only controls
  const [diffFilter, setDiffFilter] = useState<Set<Difficulty>>(new Set());
  const [maxDistance, setMaxDistance] = useState<number>(0); // 0 = any
  const [timeWindow, setTimeWindow] = useState<"any" | "today" | "week">("any");
  const [onlyJoinable, setOnlyJoinable] = useState(false);
  const [questSort, setQuestSort] = useState<"nearest" | "soonest" | "points" | "newest">("nearest");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image_urls, created_at, user_id, difficulty, points, participants_needed, quest_time, location, completed_at, evidence_urls, latitude, longitude, profiles!posts_user_id_fkey(id, display_name, avatar_url), comments(id, body, created_at, user_id, profiles!comments_user_id_fkey(id, display_name, avatar_url)), quest_participants(user_id)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    setPosts((data as unknown as PostWithCoords[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("get_my_location");
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.latitude != null && row?.longitude != null) setUserLoc({ lat: row.latitude, lon: row.longitude });
    })();
  }, [user]);

  const withDist = posts.map((p) => {
    const d = userLoc && p.latitude != null && p.longitude != null
      ? haversineKm(userLoc.lat, userLoc.lon, p.latitude, p.longitude) : null;
    return { post: p, dist: d };
  });

  // For quests tab: sort by distance asc (unknown distance last). For all tab: prefer closer quests, then recency.
  const sortByProximity = (a: { post: PostWithCoords; dist: number | null }, b: { post: PostWithCoords; dist: number | null }) => {
    if (a.dist == null && b.dist == null) return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime();
    if (a.dist == null) return 1;
    if (b.dist == null) return -1;
    return a.dist - b.dist;
  };

  const baseQuestsList = withDist.filter((x) => x.post.difficulty).sort(sortByProximity);
  const updatesList = withDist.filter((x) => !x.post.difficulty);
  const allList = tab === "all"
    ? [...baseQuestsList, ...updatesList].sort((a, b) => {
        // Boost nearby quests, otherwise recency
        const aBoost = a.post.difficulty && a.dist != null && a.dist < 50 ? -a.dist * 1000 : 0;
        const bBoost = b.post.difficulty && b.dist != null && b.dist < 50 ? -b.dist * 1000 : 0;
        const aScore = aBoost + new Date(a.post.created_at).getTime() / 1e6;
        const bScore = bBoost + new Date(b.post.created_at).getTime() / 1e6;
        return bScore - aScore;
      })
    : [];

  // Apply quests-route filters & sort
  const questsList = useMemo(() => {
    if (!isQuestsRoute) return baseQuestsList;
    const now = Date.now();
    const windowMs = timeWindow === "today" ? 24 * 3600 * 1000 : timeWindow === "week" ? 7 * 24 * 3600 * 1000 : 0;
    const filteredQ = baseQuestsList.filter(({ post: p, dist }) => {
      if (diffFilter.size > 0 && !diffFilter.has(p.difficulty as Difficulty)) return false;
      if (maxDistance > 0 && (dist == null || dist > maxDistance)) return false;
      if (windowMs > 0) {
        if (!p.quest_time) return false;
        const t = new Date(p.quest_time).getTime();
        if (t < now || t > now + windowMs) return false;
      }
      if (onlyJoinable) {
        if (p.completed_at) return false;
        if (p.participants_needed != null && (p.quest_participants?.length ?? 0) >= p.participants_needed) return false;
      }
      return true;
    });
    const sorted = [...filteredQ];
    sorted.sort((a, b) => {
      switch (questSort) {
        case "soonest": {
          const ta = a.post.quest_time ? new Date(a.post.quest_time).getTime() : Infinity;
          const tb = b.post.quest_time ? new Date(b.post.quest_time).getTime() : Infinity;
          return ta - tb;
        }
        case "points": return (b.post.points ?? 0) - (a.post.points ?? 0);
        case "newest": return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime();
        case "nearest":
        default: return sortByProximity(a, b);
      }
    });
    return sorted;
  }, [isQuestsRoute, baseQuestsList, diffFilter, maxDistance, timeWindow, onlyJoinable, questSort]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  const filtered = (tab === "all" ? allList : tab === "quests" ? questsList : updatesList);
  const counts = { all: posts.length, quests: baseQuestsList.length, updates: updatesList.length };

  const toggleDiff = (d: Difficulty) => {
    setDiffFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };
  const resetFilters = () => {
    setDiffFilter(new Set());
    setMaxDistance(0);
    setTimeWindow("any");
    setOnlyJoinable(false);
    setQuestSort("nearest");
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className={`mx-auto ${isQuestsRoute && viewMode === "map" ? "max-w-6xl" : "max-w-2xl"} px-4 py-10`}>
        <div className="mb-8 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-6">
          <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">{isQuestsRoute ? "Sidequests" : "Your feed"}</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{isQuestsRoute ? "Find your next quest" : "Quests & Adventures"}</h1>
            <p className="text-muted-foreground text-sm">{isQuestsRoute ? "Filter by difficulty, distance, and time. Join with one tap." : "Joinable sidequests and photos from adventurers around you."}</p>
          </div>
        </div>

        {isQuestsRoute && <ComposeQuest onPosted={load} />}

        {isQuestsRoute ? (
          <div className="mt-8 mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-border bg-card/60 p-1">
                <button onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <List className="size-3.5" /> List
                </button>
                <button onClick={() => setViewMode("map")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition ${viewMode === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <MapIcon className="size-3.5" /> Map
                </button>
              </div>
              <span className="text-xs text-muted-foreground">{questsList.length} of {baseQuestsList.length} quests</span>
              <div className="ml-auto inline-flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort</label>
                <select value={questSort} onChange={(e) => setQuestSort(e.target.value as typeof questSort)}
                  className="rounded-full bg-card/60 border border-border text-xs px-3 py-1.5 outline-none focus:border-primary">
                  <option value="nearest">Nearest</option>
                  <option value="soonest">Soonest</option>
                  <option value="points">Most points</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><AlignStartVertical className="size-3" /> Difficulty</span>
                {DIFFICULTIES.map((d) => {
                  const active = diffFilter.has(d);
                  return (
                    <button key={d} onClick={() => toggleDiff(d)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${active ? DIFFICULTY_STYLE[d] : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      {d}
                    </button>
                  );
                })}
                <button onClick={resetFilters} className="ml-auto text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Reset</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Max distance: {maxDistance === 0 ? "Any" : `${maxDistance} km`}</p>
                  <input type="range" min={0} max={200} step={5} value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="w-full accent-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">When</p>
                  <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
                    {(["any", "today", "week"] as const).map((w) => (
                      <button key={w} onClick={() => setTimeWindow(w)}
                        className={`px-3 py-1 rounded-full font-semibold capitalize transition ${timeWindow === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        {w === "any" ? "Anytime" : w === "today" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer self-end">
                  <input type="checkbox" checked={onlyJoinable} onChange={(e) => setOnlyJoinable(e.target.checked)}
                    className="size-4 rounded border-border accent-primary" />
                  <span>Only joinable (open spots)</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="sticky top-2 z-10 mt-8 mb-5">
            <div className="flex gap-1 p-1 rounded-full bg-card/80 backdrop-blur border border-border shadow-sm">
              {(["all", "updates"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold capitalize transition inline-flex items-center justify-center gap-1.5 ${tab === t ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_0_20px_-5px_var(--mint,theme(colors.primary.DEFAULT))]" : "text-muted-foreground hover:text-foreground"}`}>
                  <span>{t === "updates" ? "📸 Updates" : "✨ All"}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${tab === t ? "bg-black/20" : "bg-muted/50"}`}>{counts[t]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {fetching ? (
          <p className="text-muted-foreground text-center py-12">Loading posts…</p>
        ) : isQuestsRoute && viewMode === "map" ? (
          <QuestsMiniMap
            quests={questsList.map((x) => x.post)}
            userLoc={userLoc}
            onSelect={(id) => {
              setViewMode("list");
              setTimeout(() => {
                const el = document.getElementById(`quest-${id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 80);
            }}
          />
        ) : filtered.length === 0 ? (
          <div className="bento-card p-10 text-center mt-6">
            <p className="text-muted-foreground">
              {isQuestsRoute ? "No quests match your filters. Try widening the distance or clearing filters." :
               tab === "quests" ? "No joinable sidequests yet — post one with the trophy toggle above." :
               tab === "updates" ? "No photo updates yet." :
               "No posts yet. Be the first to share a side quest."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map(({ post: p, dist }) => (
              <div key={p.id} id={`quest-${p.id}`}>
                <PostCard post={p} onChange={load} currentUserId={user.id} distanceKm={dist} />
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function QuestsMiniMap({ quests, userLoc, onSelect }: {
  quests: PostWithCoords[];
  userLoc: { lat: number; lon: number } | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      const center: [number, number] = userLoc ? [userLoc.lat, userLoc.lon] : [20, 0];
      const zoom = userLoc ? 11 : 2;
      mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView(center, zoom);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!layerRef.current) return;
      layerRef.current.clearLayers();
      const pts: [number, number][] = [];
      const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

      if (userLoc) {
        L.circleMarker([userLoc.lat, userLoc.lon], { radius: 7, color: "#2dd4a8", fillColor: "#2dd4a8", fillOpacity: 0.9, weight: 2 })
          .bindTooltip("You", { direction: "top" })
          .addTo(layerRef.current);
        pts.push([userLoc.lat, userLoc.lon]);
      }

      quests.forEach((q) => {
        if (q.latitude == null || q.longitude == null) return;
        const html = `<div style="position:relative;width:40px;height:50px;filter:drop-shadow(0 2px 8px rgba(255,180,60,.6))"><div style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#fbbf24,#f97316);border:2px solid #0d1b2a"></div><div style="position:absolute;top:7px;left:7px;width:26px;height:26px;border-radius:9999px;background:#0d1b2a;display:grid;place-items:center;color:#fbbf24;font-weight:800;font-size:10px">${q.points ?? "★"}</div></div>`;
        const icon = L.divIcon({ html, className: "", iconSize: [40, 50], iconAnchor: [20, 46] });
        L.marker([q.latitude, q.longitude], { icon })
          .bindTooltip(escapeHtml(q.caption || "Sidequest"), { direction: "top" })
          .on("click", () => onSelect(q.id))
          .addTo(layerRef.current);
        pts.push([q.latitude, q.longitude]);
      });

      if (pts.length > 1) {
        const bounds = L.latLngBounds(pts);
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
  }, [ready, quests, userLoc, onSelect]);

  return (
    <div className="bento-card overflow-hidden p-0 relative h-[60vh] min-h-[420px]">
      <div ref={ref} className="absolute inset-0 z-0" />
      {quests.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <p className="text-sm text-muted-foreground bg-card/80 backdrop-blur rounded-full px-4 py-2 border border-border">No quests with a location match your filters.</p>
        </div>
      )}
    </div>
  );
}


function PostCard({ post, onChange, currentUserId, distanceKm }: { post: Post; onChange: () => void; currentUserId: string; distanceKm?: number | null }) {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const profile = post.profiles;
  const isOwner = post.user_id === currentUserId;
  const isQuest = !!post.difficulty;
  const isCompleted = !!post.completed_at;
  const participants = post.quest_participants ?? [];
  const joined = participants.some((p) => p.user_id === currentUserId);
  const full = post.participants_needed != null && participants.length >= post.participants_needed;

  const acceptQuest = async () => {
    if (joined) { navigate({ to: "/quest-chat/$questId", params: { questId: post.id } }); return; }
    if (full) { toast.error("This quest is full"); return; }

    // Basic-plan weekly limits per difficulty (resets Sunday 12am local time)
    const BASIC_WEEKLY_LIMITS: Record<Difficulty, number | null> = {
      common: null, // unlimited
      rare: 5,
      epic: 2,
      impossible: 0,
    };
    if (!isPremium && post.difficulty) {
      const limit = BASIC_WEEKLY_LIMITS[post.difficulty];
      if (limit === 0) {
        toast.error(`${post.difficulty[0].toUpperCase() + post.difficulty.slice(1)} quests are Premium-only. Upgrade to accept.`);
        return;
      }
      if (limit != null) {
        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday 00:00 local
        const { data: weekJoins, error: countErr } = await supabase
          .from("quest_participants")
          .select("post_id, joined_at, posts!inner(difficulty)")
          .eq("user_id", currentUserId)
          .eq("posts.difficulty", post.difficulty)
          .gte("joined_at", weekStart.toISOString());
        if (countErr) { toast.error(countErr.message); return; }
        if ((weekJoins?.length ?? 0) >= limit) {
          toast.error(`Basic plan limit reached: ${limit} ${post.difficulty} quest${limit === 1 ? "" : "s"}/week. Resets Sunday 12am.`);
          return;
        }
      }
    }

    setAccepting(true);
    const { error } = await supabase.from("quest_participants").insert({ post_id: post.id, user_id: currentUserId });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("You're in! Opening group chat…");
    onChange();
    navigate({ to: "/quest-chat/$questId", params: { questId: post.id } });
  };


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
      {isQuest && (post.participants_needed != null || post.quest_time || post.location) && (
        <div className="mx-4 mb-2 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {post.participants_needed != null && (
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Crew</p>
                  <p className="font-semibold">{participants.length} / {post.participants_needed}</p>
                </div>
              </div>
            )}
            {post.quest_time && (
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">When</p>
                  <p className="font-semibold truncate">{new Date(post.quest_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              </div>
            )}
            {post.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Where</p>
                  <p className="font-semibold truncate">{post.location}</p>
                  {distanceKm != null && (
                    <p className="text-[11px] text-primary/80 font-medium">
                      {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          {isCompleted ? (
            <div className="w-full rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 py-2.5 font-semibold text-sm inline-flex items-center justify-center gap-2">
              <CheckCircle2 className="size-4" />
              Completed · {post.points ?? 0} pts awarded to crew
            </div>
          ) : isOwner ? (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-primary text-primary-foreground py-2.5 font-semibold text-sm hover:opacity-90 transition inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="size-4" />
              Quest is Completed
            </button>
          ) : (
            <button
              onClick={acceptQuest}
              disabled={accepting || (full && !joined)}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
            >
              <Trophy className="size-4" />
              {joined ? "Open group chat" : full ? "Quest full" : accepting ? "Accepting…" : "Accept Quest"}
            </button>
          )}
          {isCompleted && post.evidence_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-1 mt-2">
              {post.evidence_urls.slice(0, 6).map((url, i) => {
                const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
                return isVideo
                  ? <video key={i} src={url} controls className="w-full aspect-square object-cover rounded" />
                  : <img key={i} src={url} alt="" loading="lazy" className="w-full aspect-square object-cover rounded" />;
              })}
            </div>
          )}
        </div>
      )}
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
      <div className="px-4 py-3 mt-1 flex items-center gap-2 text-sm border-t border-border/60">
        <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted/40 hover:bg-rose-500/15 hover:text-rose-400 text-muted-foreground font-medium transition">
          <Heart className="size-4" /> Like
        </button>
        <button onClick={() => setShowComments((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${showComments ? "bg-primary/15 text-primary" : "bg-muted/40 hover:bg-primary/15 hover:text-primary text-muted-foreground"}`}>
          <MessageCircle className="size-4" /> {post.comments.length} {post.comments.length === 1 ? "comment" : "comments"}
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
      {showCompleteModal && (
        <CompleteQuestModal
          post={post}
          onClose={() => setShowCompleteModal(false)}
          onCompleted={() => { setShowCompleteModal(false); onChange(); }}
        />
      )}
    </article>
  );
}

function CompleteQuestModal({ post, onClose, onCompleted }: { post: Post; onClose: () => void; onCompleted: () => void }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<{ approved: boolean; reason: string } | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []).slice(0, 6));
  };

  const submit = async () => {
    if (!user) return;
    if (files.length === 0) { toast.error("Add photo or video evidence"); return; }
    setSubmitting(true);
    setVerdict(null);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${user.id}/evidence/${post.id}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("post-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { data, error } = await supabase.functions.invoke("screen-quest-completion", {
        body: { post_id: post.id, evidence_urls: urls },
      });
      if (error) throw error;
      const result = data as { approved: boolean; reason: string; awarded?: number; points?: number; error?: string };
      if (result?.error) throw new Error(result.error);
      setVerdict({ approved: !!result.approved, reason: result.reason ?? "" });
      if (result.approved) {
        toast.success(`Quan approved! ${result.points ?? 0} pts awarded to ${result.awarded ?? 0} crew members.`);
        setTimeout(onCompleted, 1500);
      } else {
        toast.error("Quan rejected the evidence");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit evidence");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bento-card p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Submit quest evidence</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted text-muted-foreground"><X className="size-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Upload photos or a short video showing all participants finishing the quest.
          Quan will screen the evidence and award <span className="font-semibold text-foreground">{post.points ?? 0} pts</span> to each crew member if approved.
        </p>
        <label className="block rounded-xl border-2 border-dashed border-border hover:border-primary/50 p-6 text-center cursor-pointer transition">
          <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">Tap to add photos or video</p>
          <p className="text-xs text-muted-foreground mt-1">Up to 6 files</p>
          <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onPick} />
        </label>
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {files.map((f, i) => {
              const url = URL.createObjectURL(f);
              return f.type.startsWith("video/")
                ? <video key={i} src={url} className="w-full aspect-square object-cover rounded-lg bg-muted/30" />
                : <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg bg-muted/30" />;
            })}
          </div>
        )}
        {verdict && (
          <div className={`mt-4 rounded-xl border p-3 text-sm ${verdict.approved ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              {verdict.approved ? <><CheckCircle2 className="size-4" /> Quan approved</> : <><X className="size-4" /> Quan rejected</>}
            </p>
            <p className="opacity-90">{verdict.reason}</p>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold bg-muted hover:bg-muted/70 transition">Cancel</button>
          <button onClick={submit} disabled={submitting || files.length === 0}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition inline-flex items-center gap-2">
            <Sparkles className="size-4" />
            {submitting ? "Quan is reviewing…" : "Submit to Quan"}
          </button>
        </div>
      </div>
    </div>
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

function ComposeQuest({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const [location, setLocation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("common");
  const [participants, setParticipants] = useState<number>(2);
  const [questTime, setQuestTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setActivity(""); setLocation(""); setDifficulty("common"); setParticipants(2); setQuestTime("");
  };

  const submit = async () => {
    if (!user) return;
    const title = activity.trim();
    if (title.length < 3) { toast.error("Describe the activity (3+ chars)"); return; }
    if (title.length > 150) { toast.error("Keep it under 150 chars"); return; }
    if (participants < 1 || participants > 50) { toast.error("Players must be 1–50"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      caption: title,
      location: location.trim() || null,
      difficulty,
      points: DIFFICULTY_DEFAULTS[difficulty],
      participants_needed: participants,
      quest_time: questTime ? new Date(questTime).toISOString() : null,
      image_urls: [],
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quest posted!");
    reset();
    setOpen(false);
    onPosted();
  };

  if (!open) {
    return (
      <div className="mb-5">
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-primary/40 bg-card/40 hover:bg-card/60 hover:border-primary transition px-4 py-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary"
        >
          <Sparkles className="size-4" /> Post a new sidequest
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card/60 backdrop-blur p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" /> New sidequest</h3>
        <button onClick={() => { reset(); setOpen(false); }} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Activity</label>
        <input
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="e.g. Sunset hike at Bernal Heights"
          maxLength={150}
          className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Tier</label>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d;
            return (
              <button key={d} type="button" onClick={() => setDifficulty(d)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${active ? DIFFICULTY_STYLE[d] : "border-border text-muted-foreground hover:border-primary/50"}`}>
                {d} · {DIFFICULTY_DEFAULTS[d]} pts
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block inline-flex items-center gap-1"><Users className="size-3" /> Players needed</label>
          <input type="number" min={1} max={50} value={participants}
            onChange={(e) => setParticipants(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block inline-flex items-center gap-1"><Clock className="size-3" /> When (optional)</label>
          <input type="datetime-local" value={questTime}
            onChange={(e) => setQuestTime(e.target.value)}
            className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block inline-flex items-center gap-1"><MapPin className="size-3" /> Location (optional)</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mission District, SF"
          className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => { reset(); setOpen(false); }} className="rounded-full px-4 py-2 text-sm font-semibold bg-muted hover:bg-muted/70 transition">Cancel</button>
        <button onClick={submit} disabled={submitting} className="rounded-full px-5 py-2 text-sm font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50 hover:opacity-90 transition inline-flex items-center gap-2">
          <Send className="size-3.5" /> {submitting ? "Posting…" : "Post quest"}
        </button>
      </div>
    </div>
  );
}
