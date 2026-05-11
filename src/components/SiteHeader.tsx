import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <SidebarTrigger className="shrink-0" />
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
          <Link to="/feed" className="hover:text-foreground">Feed</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
