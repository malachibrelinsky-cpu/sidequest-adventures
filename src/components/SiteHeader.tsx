import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) { setAvatarUrl(null); setDisplayName(""); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setAvatarUrl(data.avatar_url ?? null);
        setDisplayName(data.display_name ?? "");
      });
    return () => { cancelled = true; };
  }, [user]);

  const initial = (displayName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <SidebarTrigger className="shrink-0" />
        {user ? (
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="hidden sm:inline">My profile</span>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Your profile"
                  className="size-8 rounded-full object-cover border border-border"
                />
              ) : (
                <span className="size-8 rounded-full bg-card border border-border flex items-center justify-center text-xs font-semibold text-foreground">
                  {initial}
                </span>
              )}
            </Link>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="rounded-full border border-border bg-card/60 p-2 hover:border-primary transition"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2 text-sm font-semibold hover:opacity-90 transition shadow-[0_0_30px_-5px_var(--mint)]"
          >
            Join SideQuest
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} SideQuest. Go outside.</p>
        <div className="flex gap-6">
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link to="/feed" className="hover:text-foreground">Feed</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
