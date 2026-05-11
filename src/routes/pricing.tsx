import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Check, Sparkles, Zap } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SideQuest" },
      { name: "description", content: "Choose Basic (free) or Premium ($8.99/mo) and unlock unlimited sidequests, full-radius map, and Quan, your AI adventure companion." },
      { property: "og:title", content: "Pricing — SideQuest" },
      { property: "og:description", content: "Basic is free. Premium is $8.99/mo and unlocks everything." },
    ],
  }),
  component: PricingPage,
});

const basic = [
  "Post 1 sidequest per week",
  "Match with 1 quester every 2 days",
  "Map limited to a 10-mile radius",
  "1 photo post & 1 comment per day",
  "Direct messaging",
];

const premium = [
  "Unlimited sidequest posts",
  "Unlimited matching, anytime",
  "Worldwide map — no radius limit",
  "Unlimited photo posts & comments",
  "Quan — your AI sidequest companion",
  "Priority placement in local feeds",
];

function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-16 flex-1">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold mb-3">Pricing</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Pick your <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">adventure tier</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you're ready to roam without limits.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic */}
          <div className="bento-card p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="size-5 text-muted-foreground" />
              <h2 className="font-display text-2xl font-bold">Basic</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">For casual questers dipping a toe in.</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-display text-5xl font-bold">$0</span>
              <span className="text-muted-foreground">/forever</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {basic.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="rounded-full border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-center hover:border-primary transition"
            >
              Get started free
            </Link>
          </div>

          {/* Premium */}
          <div className="bento-card p-8 flex flex-col relative overflow-hidden border-primary/40 glow-border">
            <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wider rounded-full bg-primary text-primary-foreground px-3 py-1 font-bold">
              Most popular
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="font-display text-2xl font-bold">Premium</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">For full-tilt adventurers who never stop matching.</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-display text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">$8.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {premium.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="size-5 text-primary shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-3 text-sm font-semibold text-center hover:opacity-90 transition shadow-[0_0_30px_-5px_var(--mint)]"
            >
              Go Premium
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Cancel anytime. Prices in USD. Taxes calculated at checkout.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
