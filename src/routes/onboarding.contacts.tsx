import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Users, ShieldCheck, Share2, ArrowRight, Search } from "lucide-react";
import { hashPhone, toE164 } from "@/lib/phone";
import type { CountryCode } from "libphonenumber-js";

export const Route = createFileRoute("/onboarding/contacts")({
  head: () => ({ meta: [{ title: "Find friends — SideQuest" }] }),
  component: ContactsOnboarding,
});

type Match = { id: string; display_name: string; avatar_url: string | null };

// Web Contact Picker types (not in lib.dom by default)
type ContactInfo = { tel?: string[] };
type ContactsManager = { select: (props: string[], options?: { multiple?: boolean }) => Promise<ContactInfo[]> };

function isContactsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "contacts" in navigator && "ContactsManager" in window;
}

function ContactsOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [scanned, setScanned] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const supported = isContactsSupported();

  const findFriends = async () => {
    if (!supported) return;
    setBusy(true);
    try {
      // @ts-expect-error - non-standard browser API
      const cm: ContactsManager = navigator.contacts;
      const picked = await cm.select(["tel"], { multiple: true });
      const phones = new Set<string>();
      for (const c of picked) {
        for (const raw of c.tel ?? []) {
          // Try to normalize; fall back to common locales
          const candidates: (CountryCode | undefined)[] = [undefined, "US", "GB", "CA", "AU"];
          for (const cc of candidates) {
            const e164 = toE164(raw, cc ?? "US");
            if (e164) { phones.add(e164); break; }
          }
        }
      }
      setScanned(phones.size);
      if (phones.size === 0) { toast.info("No phone numbers found in selection"); return; }

      const hashes = await Promise.all(Array.from(phones).map(hashPhone));
      const { data, error } = await supabase.rpc("find_friends_by_phone_hashes", { hashes });
      if (error) throw error;
      setMatches((data ?? []) as Match[]);
      await supabase.rpc("mark_contacts_synced");
      toast.success(`Found ${data?.length ?? 0} friend${data?.length === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't read contacts";
      if (msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("cancel")) return;
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on SideQuest", text: "Find quests, meet people, explore.", url: inviteUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-md bento-card p-8 space-y-5">
        <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center">
          <Users className="size-6 text-primary-foreground" strokeWidth={2.4} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Find friends already here</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We'll match your contacts against SideQuest accounts so you can pick up where you left off.
          </p>
        </div>

        <div className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <div className="flex gap-2"><ShieldCheck className="size-4 text-primary shrink-0" />
            <p><span className="font-medium text-foreground">Your contacts never leave your device.</span> We hash phone numbers locally and only send the hashes — never names or full numbers.</p>
          </div>
          <p>You can hide yourself from contact discovery anytime in Settings.</p>
        </div>

        {matches === null ? (
          <>
            {supported ? (
              <button onClick={findFriends} disabled={busy}
                className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2">
                <Search className="size-4" /> {busy ? "Scanning..." : "Find friends from contacts"}
              </button>
            ) : (
              <div className="rounded-xl border border-border p-4 text-sm space-y-3">
                <p className="text-muted-foreground">
                  Your browser doesn't support the contact picker (it works on Chrome for Android).
                  You can still invite friends with a link instead.
                </p>
                <button onClick={share}
                  className="w-full rounded-full bg-secondary text-secondary-foreground py-2.5 font-semibold hover:opacity-90 transition flex items-center justify-center gap-2">
                  <Share2 className="size-4" /> Share invite link
                </button>
              </div>
            )}
            <button onClick={() => navigate({ to: "/feed" })}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition flex items-center justify-center gap-1">
              Skip for now <ArrowRight className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Scanned {scanned} contacts · {matches.length} match{matches.length === 1 ? "" : "es"}</p>
            {matches.length > 0 ? (
              <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {matches.map((m) => (
                  <li key={m.id}>
                    <Link to="/u/$userId" params={{ userId: m.id }} onClick={() => navigate({ to: "/feed" })}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary transition">
                      <div className="size-10 rounded-full bg-muted overflow-hidden grid place-items-center text-sm font-semibold">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="size-full object-cover" /> : (m.display_name?.[0] ?? "?")}
                      </div>
                      <span className="font-medium">{m.display_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No friends found yet — invite some!</p>
            )}
            <button onClick={() => navigate({ to: "/feed" })}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold hover:opacity-90 transition">
              Continue to SideQuest
            </button>
          </>
        )}
      </div>
    </div>
  );
}
