import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Trophy, Lock, Plus, Users, Copy, LogOut, Sparkles, Check, Flame } from "lucide-react";
import { computeStreak, streakMultiplier, formatCountdown, computeBadges, flatBadges, bestEverStreak, type CompletionRow } from "@/lib/streaks";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — SideQuest" },
      { name: "description", content: "Earn points completing sidequests. Compete worldwide or with your private crew." },
      { property: "og:title", content: "SideQuest Leaderboard — Top questers this week" },
      { property: "og:description", content: "See top questers worldwide, build streaks, and rally your private crew on the SideQuest leaderboard." },
    ],
  }),
  component: LeaderboardPage,
});

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Leaderboard = { id: string; name: string; invite_code: string; owner_id: string };

function LeaderboardPage() {
  const { user, loading } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"world" | "private">("world");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-primary font-semibold text-sm mb-2 inline-flex items-center gap-2"><Trophy className="size-4" /> LEADERBOARD</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">Earn points. Outpace your crew.</h1>
            <p className="text-muted-foreground">Harder quests = more points. Keep your streak alive for a multiplier.</p>
          </div>
          <div className="bento-card p-4 max-w-sm text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1 inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Auto-logged</p>
            Points are awarded automatically when the quest leader marks an invite as complete and Quan approves the evidence.
          </div>
        </div>

        <StreakBanner userId={user.id} />

        <div className="flex gap-2 border-b border-border mb-6">
          <TabBtn active={tab === "world"} onClick={() => setTab("world")}>🌍 Worldwide</TabBtn>
          <TabBtn active={tab === "private"} onClick={() => setTab("private")}>
            <span className="inline-flex items-center gap-1.5">
              {!isPremium && <Lock className="size-3.5" />} Private leagues
            </span>
          </TabBtn>
        </div>

        {tab === "world" ? <WorldLeaderboard currentUserId={user.id} /> : isPremium ? <PrivateLeagues userId={user.id} /> : <PremiumLock />}
      </main>
      <SiteFooter />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );
}

function PremiumLock() {
  return (
    <div className="bento-card p-10 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 grid place-items-center mb-4">
        <Lock className="size-6 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Private leagues are a Premium perk</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">Create invite-only leaderboards with your friends, roommates, or run club. Compete just within your circle.</p>
      <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-3 font-semibold hover:opacity-90 transition">
        <Sparkles className="size-4" /> Upgrade to Premium
      </Link>
    </div>
  );
}


type RankRow = { profile: Profile; total: number; count: number; comps: CompletionRow[] };

function useLeaderboardData(userIds: string[] | null) {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("quest_completions").select("user_id, points, difficulty, created_at");
    if (userIds) q = q.in("user_id", userIds);
    const { data: comps, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const totals = new Map<string, { total: number; count: number; comps: CompletionRow[] }>();
    (comps ?? []).forEach((c: { user_id: string; points: number; difficulty: string; created_at: string }) => {
      const cur = totals.get(c.user_id) ?? { total: 0, count: 0, comps: [] };
      cur.total += c.points; cur.count += 1;
      cur.comps.push({ created_at: c.created_at, difficulty: c.difficulty, points: c.points });
      totals.set(c.user_id, cur);
    });
    const ids = Array.from(totals.keys());
    if (ids.length === 0) { setRows([]); setLoading(false); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
    const merged: RankRow[] = (profiles ?? []).map((p) => ({
      profile: p as Profile,
      ...(totals.get(p.id) ?? { total: 0, count: 0, comps: [] }),
    }));
    merged.sort((a, b) => b.total - a.total);
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("completions:refresh", handler);
    return () => window.removeEventListener("completions:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds?.join(",")]);

  return { rows, loading };
}

function WorldLeaderboard({ currentUserId }: { currentUserId: string }) {
  const { rows, loading } = useLeaderboardData(null);
  return <RankingTable rows={rows} loading={loading} currentUserId={currentUserId} emptyText="No quests logged yet. Be the first!" />;
}

function PrivateLeagues({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<Leaderboard[]>([]);
  const [active, setActive] = useState<Leaderboard | null>(null);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    const { data: memberRows } = await supabase.from("leaderboard_members").select("leaderboard_id").eq("user_id", userId);
    const ids = (memberRows ?? []).map((m) => m.leaderboard_id);
    if (ids.length === 0) { setBoards([]); return; }
    const { data } = await supabase.from("leaderboards").select("id, name, invite_code, owner_id").in("id", ids);
    setBoards((data as Leaderboard[]) ?? []);
    if (!active && data && data.length > 0) setActive(data[0] as Leaderboard);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const create = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from("leaderboards").insert({ owner_id: userId, name: name.trim().slice(0, 60) }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("leaderboard_members").insert({ leaderboard_id: data.id, user_id: userId });
    setName(""); toast.success("League created!"); load();
  };

  const join = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) return;
    const { data, error } = await supabase.from("leaderboards").select("id, name, invite_code, owner_id").eq("invite_code", code).maybeSingle();
    if (error || !data) { toast.error("League not found"); return; }
    const { error: joinErr } = await supabase.from("leaderboard_members").insert({ leaderboard_id: data.id, user_id: userId });
    if (joinErr && !joinErr.message.includes("duplicate")) { toast.error(joinErr.message); return; }
    setJoinCode(""); toast.success(`Joined ${data.name}!`); load();
  };

  const leave = async (lb: Leaderboard) => {
    const { error } = await supabase.from("leaderboard_members").delete().eq("leaderboard_id", lb.id).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    if (lb.owner_id === userId) await supabase.from("leaderboards").delete().eq("id", lb.id);
    setActive(null); load();
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bento-card p-5">
          <h3 className="font-bold mb-3 inline-flex items-center gap-2"><Plus className="size-4 text-primary" /> Create a league</h3>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Friday Night Crew" className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
            <button onClick={create} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Create</button>
          </div>
        </div>
        <div className="bento-card p-5">
          <h3 className="font-bold mb-3 inline-flex items-center gap-2"><Users className="size-4 text-primary" /> Join with code</h3>
          <div className="flex gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="invite code" className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
            <button onClick={join} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Join</button>
          </div>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="bento-card p-10 text-center text-muted-foreground">No leagues yet. Create one or join with a code.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {boards.map((b) => (
              <button key={b.id} onClick={() => setActive(b)} className={`rounded-full px-4 py-1.5 text-sm font-medium border transition ${active?.id === b.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {b.name}
              </button>
            ))}
          </div>
          {active && <PrivateBoardView lb={active} userId={userId} onLeave={() => leave(active)} />}
        </>
      )}
    </div>
  );
}

function PrivateBoardView({ lb, userId, onLeave }: { lb: Leaderboard; userId: string; onLeave: () => void }) {
  const [memberIds, setMemberIds] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from("leaderboard_members").select("user_id").eq("leaderboard_id", lb.id).then(({ data }) => {
      setMemberIds((data ?? []).map((m) => m.user_id));
    });
  }, [lb.id]);

  const { rows, loading } = useLeaderboardData(memberIds);

  const copyCode = () => {
    navigator.clipboard.writeText(lb.invite_code);
    setCopied(true);
    toast.success("Invite code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bento-card p-6">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{lb.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{memberIds?.length ?? 0} members</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyCode} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-mono hover:border-primary transition">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {lb.invite_code}
          </button>
          <button onClick={onLeave} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-destructive hover:text-destructive transition">
            <LogOut className="size-3.5" /> {lb.owner_id === userId ? "Delete" : "Leave"}
          </button>
        </div>
      </div>
      <RankingTable rows={rows} loading={loading} currentUserId={userId} emptyText="No completions in this league yet." />
    </div>
  );
}

function RankingTable({ rows, loading, currentUserId, emptyText }: { rows: RankRow[]; loading: boolean; currentUserId: string; emptyText: string }) {
  const medals = useMemo(() => ["🥇", "🥈", "🥉"], []);
  if (loading) return <div className="bento-card p-10 text-center text-muted-foreground">Loading rankings…</div>;
  if (rows.length === 0) return <div className="bento-card p-10 text-center text-muted-foreground">{emptyText}</div>;
  return (
    <div className="bento-card overflow-hidden">
      {rows.map((r, i) => {
        const isMe = r.profile.id === currentUserId;
        const badges = computeBadges({ totalPoints: r.total, completions: r.comps });
        const streak = computeStreak(r.comps);
        const topBadges = flatBadges(badges).slice(0, 3);
        return (
          <div key={r.profile.id} className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 ${isMe ? "bg-primary/5" : ""}`}>
            <div className="w-10 text-center font-bold text-lg">{i < 3 ? medals[i] : `#${i + 1}`}</div>
            {r.profile.avatar_url
              ? <img src={r.profile.avatar_url} alt="" className="size-10 rounded-full object-cover" />
              : <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold">{r.profile.display_name[0]?.toUpperCase()}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate flex items-center gap-2 flex-wrap">
                {r.profile.display_name}
                {badges.rank && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20" title={badges.rank.description}>{badges.rank.emoji} {badges.rank.label}</span>}
                {isMe && <span className="text-xs text-primary">(you)</span>}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{r.count} {r.count === 1 ? "quest" : "quests"}</span>
                {streak.alive && <span className="inline-flex items-center gap-1 text-orange-400"><Flame className="size-3" />{streak.count}-day streak</span>}
                <span className="flex gap-1">{topBadges.filter(b => b.id !== badges.rank?.id).map(b => <span key={b.id} title={`${b.label} — ${b.description}`}>{b.emoji}</span>)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">{r.total.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">points</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StreakBanner({ userId }: { userId: string }) {
  const { isPremium } = usePremium();
  const [comps, setComps] = useState<CompletionRow[] | null>(null);
  const [sub, setSub] = useState<{ last_streak_revive_at: string | null; current_period_end: string | null } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [reviving, setReviving] = useState(false);

  const loadAll = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("quest_completions").select("created_at, difficulty, points").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("subscribers").select("last_streak_revive_at, current_period_end").eq("user_id", userId).maybeSingle(),
    ]);
    setComps((c ?? []) as CompletionRow[]);
    setSub((s as typeof sub) ?? { last_streak_revive_at: null, current_period_end: null });
  };

  useEffect(() => {
    let alive = true;
    loadAll().then(() => { if (!alive) return; });
    const handler = () => loadAll();
    window.addEventListener("completions:refresh", handler);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { alive = false; window.removeEventListener("completions:refresh", handler); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!comps) return null;
  const streak = computeStreak(comps, now);
  const best = bestEverStreak(comps);
  const nextMult = streakMultiplier(streak.alive ? streak.count + 1 : 1);

  // Revive eligibility: premium + dead streak + had a previous streak + not used this period.
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const periodStart = periodEnd ? new Date(periodEnd.getTime() - 31 * 24 * 60 * 60 * 1000) : null;
  const lastRevive = sub?.last_streak_revive_at ? new Date(sub.last_streak_revive_at) : null;
  const reviveUsedThisPeriod = !!(lastRevive && periodStart && lastRevive >= periodStart);
  const canRevive = isPremium && !streak.alive && comps.length > 0 && !reviveUsedThisPeriod;

  const revive = async () => {
    if (!canRevive || !comps.length) return;
    setReviving(true);
    const { error: rpcErr } = await supabase.rpc("revive_streak");
    if (rpcErr) { setReviving(false); toast.error(rpcErr.message); return; }
    toast.success("Streak revived! 🛟🔥");
    setReviving(false);
    await loadAll();
    window.dispatchEvent(new Event("completions:refresh"));
  };

  return (
    <div className="bento-card p-5 mb-6 flex items-center gap-5 flex-wrap">
      <div className={`size-14 rounded-2xl grid place-items-center text-2xl ${streak.alive ? "bg-gradient-to-br from-orange-500/30 to-red-500/20 text-orange-400" : "bg-muted/40 text-muted-foreground"}`}>
        <Flame className="size-7" />
      </div>
      <div className="flex-1 min-w-[180px]">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{streak.alive ? "Current streak" : "Streak"}</p>
        <p className="text-2xl font-bold">
          {streak.alive ? `${streak.count}` : "0"}
          <span className="text-sm font-normal text-muted-foreground ml-2">{streak.alive ? "in a row" : "— complete a quest to start one"}</span>
        </p>
        {best > 0 && <p className="text-xs text-muted-foreground mt-0.5">Best ever: {best}</p>}
      </div>
      {streak.alive && (
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Expires in</p>
          <p className="text-2xl font-mono font-bold tabular-nums text-orange-400">{formatCountdown(streak.msRemaining)}</p>
        </div>
      )}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Next quest bonus</p>
        <p className="text-2xl font-bold text-primary">{nextMult.toFixed(2)}×</p>
      </div>
      {!streak.alive && comps.length > 0 && (
        <div className="w-full mt-2 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <p className="font-semibold inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Premium perk: Streak Revive</p>
            <p className="text-xs text-muted-foreground">
              {isPremium
                ? reviveUsedThisPeriod
                  ? `Already used this period${periodEnd ? ` — refreshes ${periodEnd.toLocaleDateString()}` : ""}.`
                  : "Bring your last streak back to life. One revive per billing period."
                : "Upgrade to Premium to revive a lost streak once per billing period."}
            </p>
          </div>
          {isPremium ? (
            <button onClick={revive} disabled={!canRevive || reviving}
              className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
              <Flame className="size-4" /> {reviving ? "Reviving…" : "Revive streak"}
            </button>
          ) : (
            <Link to="/pricing" className="rounded-full border border-primary text-primary px-5 py-2 text-sm font-semibold hover:bg-primary/10 transition">
              Upgrade
            </Link>
          )}
        </div>
      )}
    </div>
  );
}


