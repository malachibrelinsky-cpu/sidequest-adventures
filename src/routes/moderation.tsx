import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/moderation")({
  head: () => ({ meta: [{ title: "Moderation queue — SideQuest" }] }),
  component: ModerationPage,
});

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  context: string | null;
  ai_verdict: string | null;
  ai_reasoning: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
};

type Profile = { id: string; display_name: string; avatar_url: string | null };

const VERDICT_COLOR: Record<string, string> = {
  dismiss: "bg-muted text-muted-foreground",
  warn: "bg-yellow-500/20 text-yellow-400",
  escalate: "bg-orange-500/20 text-orange-400",
  recommend_suspend: "bg-destructive/20 text-destructive",
  recommend_ban: "bg-destructive/30 text-destructive",
  error: "bg-muted text-muted-foreground",
};

function ModerationPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r) => r.role);
      setAllowed(roles.includes("admin") || roles.includes("moderator"));
    });
  }, [user]);

  const load = async () => {
    const { data: r } = await supabase.from("user_reports").select("*").order("created_at", { ascending: false }).limit(200);
    const list = (r as Report[]) ?? [];
    setReports(list);
    const ids = Array.from(new Set(list.flatMap((x) => [x.reporter_id, x.reported_user_id])));
    if (ids.length > 0) {
      const { data: p } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      setProfiles(new Map((p ?? []).map((x) => [x.id, x])));
    }
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  const apply = async (report: Report, action: "dismiss" | "warn" | "suspend" | "ban") => {
    if (!user) return;
    setBusy(report.id);
    let resolution: string;
    let modStatus: string | null = null;
    if (action === "dismiss") { resolution = "dismissed"; }
    else if (action === "warn") { resolution = "warned"; modStatus = "warned"; }
    else if (action === "suspend") { resolution = "suspended"; modStatus = "suspended"; }
    else { resolution = "banned"; modStatus = "banned"; }

    const { error: e1 } = await supabase
      .from("user_reports")
      .update({ status: "resolved", resolution, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", report.id);
    if (e1) { toast.error(e1.message); setBusy(null); return; }

    if (modStatus) {
      const { error: e2 } = await supabase
        .from("user_moderation")
        .upsert({
          user_id: report.reported_user_id,
          status: modStatus,
          reason: `${report.reason} (report ${report.id.slice(0, 8)})`,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (e2) { toast.error(e2.message); setBusy(null); return; }
    }

    toast.success(`Report ${resolution}`);
    setBusy(null);
    await load();
  };

  if (loading || !user || allowed === null) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <ShieldCheck className="size-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Moderators only</h1>
          <p className="text-muted-foreground">You need an admin or moderator role to view the moderation queue.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const filtered = reports.filter((r) => {
    if (filter === "open") return r.status !== "resolved";
    if (filter === "resolved") return r.status === "resolved";
    return true;
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Moderation queue</h1>
            <p className="text-sm text-muted-foreground">Quan triages reports. You decide what happens next.</p>
          </div>
          <div className="flex gap-1 rounded-full bg-input/40 p-1">
            {(["open", "resolved", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bento-card p-12 text-center text-muted-foreground">No reports.</div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((r) => {
              const reported = profiles.get(r.reported_user_id);
              const reporter = profiles.get(r.reporter_id);
              return (
                <li key={r.id} className="bento-card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Link to="/u/$userId" params={{ userId: r.reported_user_id }}
                      className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-sm text-primary-foreground font-bold overflow-hidden shrink-0">
                      {reported?.avatar_url ? <img src={reported.avatar_url} alt="" className="w-full h-full object-cover" /> : (reported?.display_name?.[0]?.toUpperCase() ?? "?")}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to="/u/$userId" params={{ userId: r.reported_user_id }} className="font-bold hover:text-primary truncate">
                          {reported?.display_name ?? "Unknown user"}
                        </Link>
                        {r.ai_verdict && (
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${VERDICT_COLOR[r.ai_verdict] ?? "bg-muted text-muted-foreground"}`}>
                            Quan: {r.ai_verdict.replace("_", " ")}
                          </span>
                        )}
                        {r.status === "resolved" && r.resolution && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-primary/20 text-primary">
                            {r.resolution}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reported by {reporter?.display_name ?? "someone"} · {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-input/30 p-3 mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reason</p>
                    <p className="text-sm">{r.reason}</p>
                    {r.context && (
                      <>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 mb-1">Context</p>
                        <p className="text-sm text-muted-foreground">{r.context}</p>
                      </>
                    )}
                  </div>

                  {r.ai_reasoning && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-3 flex gap-2">
                      <AlertTriangle className="size-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">Quan's reasoning</p>
                        <p className="text-sm">{r.ai_reasoning}</p>
                      </div>
                    </div>
                  )}

                  {r.status !== "resolved" && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button disabled={busy === r.id} onClick={() => apply(r, "dismiss")}
                        className="text-xs font-semibold rounded-full px-4 py-2 bg-muted hover:bg-muted/70 transition disabled:opacity-50">Dismiss</button>
                      <button disabled={busy === r.id} onClick={() => apply(r, "warn")}
                        className="text-xs font-semibold rounded-full px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition disabled:opacity-50">Warn</button>
                      <button disabled={busy === r.id} onClick={() => apply(r, "suspend")}
                        className="text-xs font-semibold rounded-full px-4 py-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition disabled:opacity-50">Suspend</button>
                      <button disabled={busy === r.id} onClick={() => { if (confirm("Permanently ban this user?")) apply(r, "ban"); }}
                        className="text-xs font-semibold rounded-full px-4 py-2 bg-destructive/20 text-destructive hover:bg-destructive/30 transition disabled:opacity-50">Ban</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
