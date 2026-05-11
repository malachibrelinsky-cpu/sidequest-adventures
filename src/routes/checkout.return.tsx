import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 size-16 rounded-full bg-primary/15 grid place-items-center">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {sessionId ? "Welcome to Premium!" : "Checkout closed"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {sessionId
            ? "Your subscription is active. Adventures unlocked."
            : "No payment was completed."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/feed" className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-3 text-sm font-semibold hover:opacity-90 transition">
            Go to Feed
          </Link>
          <Link to="/profile" className="rounded-full border border-border bg-card/60 px-5 py-3 text-sm font-semibold hover:border-primary transition">
            My profile
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
