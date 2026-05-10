import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow-border">
            <Compass className="size-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">SideQuest</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link to="/quests" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">Quests</Link>
          <Link to="/map" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">Map</Link>
          <Link to="/feed" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">Feed</Link>
          {user && <Link to="/messages" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">Messages</Link>}
          {user && <Link to="/quan" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition inline-flex items-center gap-1">Quan <span className="text-[10px] uppercase tracking-wider rounded bg-primary/20 text-primary px-1.5 py-0.5 font-bold">AI</span></Link>}
          <Link to="/pricing" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">Pricing</Link>
          <Link to="/how-it-works" activeProps={{ className: "text-primary" }} className="hover:text-foreground transition">How it works</Link>
        </nav>
        {user ? (
          <div className="flex items-center gap-3">
            <Link to="/profile" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground">My profile</Link>
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
          <Link to="/quests" className="hover:text-foreground">Quests</Link>
        </div>
      </div>
    </footer>
  );
}
