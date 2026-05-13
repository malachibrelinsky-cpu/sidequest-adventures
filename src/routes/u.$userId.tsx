import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Star, Flag, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/u/$userId")({
  head: () => ({ meta: [{ title: "Profile — SideQuest" }] }),
  component: PublicProfilePage,
});

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[] | null;
};

type Rating = {
  id: string;
  rater_id: string;
  stars: number;
  review: string | null;
  created_at: string;
  rater?: { display_name: string; avatar_url: string | null } | null;
};

type Mod = { status: string; reason: string | null; until: string | null } | null;

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [mod, setMod] = useState<Mod>(null);
  const [myRating, setMyRating] = useState<{ stars: number; review: string } | null>(null);
  const [draftStars, setDraftStars] = useState(0);
  const [draftReview, setDraftReview] = useState("");
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportContext, setReportContext] = useState("");
  const [reporting, setReporting] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const isSelf = user?.id === userId;

  const load = async () => {
    const [{ data: p }, { data: r }, { data: m }, { count: fCount }, { count: gCount }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url, bio, city, interests").eq("id", userId).maybeSingle(),
      supabase.from("profile_ratings").select("id, rater_id, stars, review, created_at").eq("ratee_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_moderation").select("status, reason, until").eq("user_id", userId).maybeSingle(),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    setFollowerCount(fCount ?? 0);
    setFollowingCount(gCount ?? 0);
    if (user && !isSelf) {
      const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle();
      setIsFollowing(!!f);
    } else {
      setIsFollowing(false);
    }
    setProfile(p as Profile | null);
    let withRaters: Rating[] = [];
    if (r && r.length > 0) {
      const raterIds = Array.from(new Set(r.map((x) => x.rater_id)));
      const { data: raters } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", raterIds);
      const map = new Map((raters ?? []).map((x) => [x.id, { display_name: x.display_name, avatar_url: x.avatar_url }]));
      withRaters = r.map((x) => ({ ...x, rater: map.get(x.rater_id) ?? null }));
    }
    setRatings(withRaters);
    setMod(m as Mod);
    if (user && !isSelf) {
      const mine = (r ?? []).find((x) => x.rater_id === user.id);
      if (mine) {
        setMyRating({ stars: mine.stars, review: mine.review ?? "" });
        setDraftStars(mine.stars);
        setDraftReview(mine.review ?? "");
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, user?.id]);

  const avg = useMemo(() => {
    if (ratings.length === 0) return 0;
    return ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
  }, [ratings]);

  const submitRating = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (draftStars < 1 || draftStars > 5) { toast.error("Pick 1-5 stars"); return; }
    if (draftReview.length > 100) { toast.error("Review must be 100 characters or fewer"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profile_ratings")
      .upsert({
        rater_id: user.id,
        ratee_id: userId,
        stars: draftStars,
        review: draftReview.trim() || null,
      }, { onConflict: "rater_id,ratee_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(myRating ? "Rating updated" : "Rating submitted");
    await load();
  };

  const removeRating = async () => {
    if (!user) return;
    const { error } = await supabase.from("profile_ratings").delete().eq("rater_id", user.id).eq("ratee_id", userId);
    if (error) { toast.error(error.message); return; }
    setMyRating(null);
    setDraftStars(0);
    setDraftReview("");
    toast.success("Rating removed");
    await load();
  };

  const toggleFollow = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    setFollowBusy(true);
    if (isFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      if (error) { toast.error(error.message); setFollowBusy(false); return; }
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
      if (error) { toast.error(error.message); setFollowBusy(false); return; }
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowBusy(false);
  };

  const submitReport = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (reportReason.trim().length < 3) { toast.error("Describe the issue"); return; }
    setReporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/screen-user-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          reported_user_id: userId,
          reason: reportReason.trim(),
          context: reportContext.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Report failed");
      } else {
        toast.success(json.message ?? "Report filed. Quan is reviewing — a human moderator will follow up if needed.");
        setReportOpen(false);
        setReportReason("");
        setReportContext("");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setReporting(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        {/* Header */}
        <div className="bento-card p-6">
          <div className="flex items-start gap-4">
            <div className="size-20 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold text-2xl overflow-hidden shrink-0">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : profile.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{profile.display_name}</h1>
                {mod && mod.status !== "active" && (
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${mod.status === "banned" ? "bg-destructive/20 text-destructive" : "bg-orange-500/20 text-orange-400"}`}>
                    {mod.status}
                  </span>
                )}
              </div>
              {profile.city && <p className="text-sm text-muted-foreground">{profile.city}</p>}
              {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
              <div className="mt-3 flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold">{ratings.length === 0 ? "—" : avg.toFixed(1)}</span>
                  <span className="text-muted-foreground">({ratings.length})</span>
                </div>
                <span className="text-muted-foreground"><span className="font-bold text-foreground">{followerCount}</span> followers</span>
                <span className="text-muted-foreground"><span className="font-bold text-foreground">{followingCount}</span> following</span>
                {!isSelf && (
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${isFollowing ? "border border-border bg-card hover:border-destructive hover:text-destructive" : "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"}`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
                {!isSelf && user && (
                  <button onClick={() => setReportOpen(true)} className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition">
                    <Flag className="size-3.5" /> Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rate this user */}
        {user && !isSelf && (
          <div className="bento-card p-6">
            <h2 className="text-lg font-bold mb-3">{myRating ? "Your rating" : "Rate this user"}</h2>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setDraftStars(n)}
                  className="p-1 transition"
                  aria-label={`${n} stars`}
                >
                  <Star className={`size-7 transition ${(hover || draftStars) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={draftReview}
              onChange={(e) => setDraftReview(e.target.value.slice(0, 100))}
              placeholder="Optional review (100 chars max)"
              maxLength={100}
              rows={2}
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 outline-none focus:border-primary resize-none text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{draftReview.length}/100</span>
              <div className="flex gap-2">
                {myRating && (
                  <button onClick={removeRating} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                )}
                <button
                  onClick={submitRating}
                  disabled={saving || draftStars < 1}
                  className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-1.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition"
                >
                  {saving ? "Saving…" : myRating ? "Update" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reviews list */}
        <div className="bento-card p-6">
          <h2 className="text-lg font-bold mb-4">Reviews</h2>
          {ratings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="space-y-4">
              {ratings.map((r) => (
                <li key={r.id} className="flex items-start gap-3">
                  <Link to="/u/$userId" params={{ userId: r.rater_id }} className="size-9 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-xs text-primary-foreground font-bold overflow-hidden shrink-0">
                    {r.rater?.avatar_url ? <img src={r.rater.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.rater?.display_name?.[0]?.toUpperCase() ?? "?")}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to="/u/$userId" params={{ userId: r.rater_id }} className="text-sm font-semibold hover:text-primary truncate">
                        {r.rater?.display_name ?? "User"}
                      </Link>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`size-3.5 ${r.stars >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                        ))}
                      </div>
                    </div>
                    {r.review && <p className="text-sm mt-1 text-muted-foreground">{r.review}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />

      {reportOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setReportOpen(false)}>
          <div className="bento-card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="size-5 text-destructive" />
              <h3 className="text-lg font-bold">Report {profile.display_name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Quan (AI) reviews every report first. A human moderator approves any account action — Quan can never suspend or ban anyone on its own.</p>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">What's the issue?</label>
            <input
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value.slice(0, 500))}
              placeholder="e.g., harassment, spam, inappropriate behavior"
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 outline-none focus:border-primary text-sm mb-3"
            />
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Details (optional)</label>
            <textarea
              value={reportContext}
              onChange={(e) => setReportContext(e.target.value.slice(0, 1000))}
              rows={3}
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-2.5 outline-none focus:border-primary text-sm resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReportOpen(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2">Cancel</button>
              <button
                onClick={submitReport}
                disabled={reporting}
                className="rounded-full bg-destructive text-destructive-foreground px-5 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition"
              >
                {reporting ? "Filing…" : "File report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
