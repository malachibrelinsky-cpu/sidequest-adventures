import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Trophy, Lock, Plus, Users, Copy, LogOut, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — SideQuest" },
      { name: "description", content: "Earn points completing sidequests. Compete worldwide or with your private crew." },
    ],
  }),
  component: LeaderboardPage,
});

const DIFFICULTY_POINTS = { easy: 10, medium: 25, hard: 60, epic: 150 } as const;
type Difficulty = keyof typeof DIFFICULTY_POINTS;

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Completion = { id: string; user_id: string; title: string; difficulty: Difficulty; points: number; created_at: string };
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
            <p className="text-muted-foreground">Log every quest you finish — harder quests = more points.</p>
          </div>
          <LogCompletion onLogged={() => window.dispatchEvent(new Event("completions:refresh"))} userId={user.id} />
        </div>

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

function LogCompletion({ onLogged, userId }: { onLogged: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Add a quest title"); return; }
    setSaving(true);
    const points = DIFFICULTY_POINTS[difficulty];
    const { error } = await supabase.from("quest_completions").insert({ user_id: userId, title: title.trim().slice(0, 120), difficulty, points });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`+${points} points!`);
    setTitle(""); setDifficulty("medium"); setOpen(false);
    onLogged();
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90">
      <Plus className="size-4" /> Log a completion
    </button>
  );

  return (
    <div className="bento-card p-5 w-full max-w-md">
      <h3 className="font-bold mb-3">Log a completed quest</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunset Bridge Walk" maxLength={120} className="w-full rounded-lg bg-input/40 border border-border px-3 py-2 text-sm mb-3 outline-none focus:border-primary" />
      <div className="grid grid-cols-4 gap-2 mb-4">
        {(Object.keys(DIFFICULTY_POINTS) as Difficulty[]).map((d) => (
          <button key={d} onClick={() => setDifficulty(d)} className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition ${difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {d}<br /><span className="text-[10px] opacity-70">+{DIFFICULTY_POINTS[d]}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="flex-1 rounded-full bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}

function useLeaderboardData(userIds: string[] | null) {
  const [rows, setRows] = useState<{ profile: Profile; total: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("quest_completions").select("user_id, points");
    if (userIds) q = q.in("user_id", userIds);
    const { data: comps, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const totals = new Map<string, { total: number; count: number }>();
    (comps ?? []).forEach((c: { user_id: string; points: number }) => {
      const cur = totals.get(c.user_id) ?? { total: 0, count: 0 };
      totals.set(c.user_id, { total: cur.total + c.points, count: cur.count + 1 });
    });
    const ids = Array.from(totals.keys());
    if (ids.length === 0) { setRows([]); setLoading(false); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
    const merged = (profiles ?? []).map((p) => ({ profile: p as Profile, ...(totals.get(p.id) ?? { total: 0, count: 0 }) }));
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

function RankingTable({ rows, loading, currentUserId, emptyText }: { rows: { profile: Profile; total: number; count: number }[]; loading: boolean; currentUserId: string; emptyText: string }) {
  const medals = useMemo(() => ["🥇", "🥈", "🥉"], []);
  if (loading) return <div className="bento-card p-10 text-center text-muted-foreground">Loading rankings…</div>;
  if (rows.length === 0) return <div className="bento-card p-10 text-center text-muted-foreground">{emptyText}</div>;
  return (
    <div className="bento-card overflow-hidden">
      {rows.map((r, i) => {
        const isMe = r.profile.id === currentUserId;
        return (
          <div key={r.profile.id} className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 ${isMe ? "bg-primary/5" : ""}`}>
            <div className="w-10 text-center font-bold text-lg">{i < 3 ? medals[i] : `#${i + 1}`}</div>
            {r.profile.avatar_url
              ? <img src={r.profile.avatar_url} alt="" className="size-10 rounded-full object-cover" />
              : <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold">{r.profile.display_name[0]?.toUpperCase()}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.profile.display_name}{isMe && <span className="ml-2 text-xs text-primary">(you)</span>}</p>
              <p className="text-xs text-muted-foreground">{r.count} {r.count === 1 ? "quest" : "quests"} completed</p>
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
