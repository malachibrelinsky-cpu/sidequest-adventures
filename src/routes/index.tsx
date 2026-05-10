import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import heroImg from "@/assets/hero.jpg";
import mapImg from "@/assets/map.jpg";
import connectImg from "@/assets/connect.jpg";
import { MapPin, Users, Sparkles, Clock, Zap, Coffee } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SideQuest — Tiny adventures with people nearby" },
      { name: "description", content: "Connect with locals and embark on short, spontaneous adventures. Coffee crawls, sunset hikes, trivia nights — your next side quest is around the corner." },
      { property: "og:title", content: "SideQuest — Tiny adventures with people nearby" },
      { property: "og:description", content: "Connect with locals and embark on short, spontaneous adventures." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <section className="pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> Now live in 24 cities
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[0.95]">
              Your next <span className="text-gradient-mint">side quest</span> starts two blocks away.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              SideQuest matches you with locals for short, fun adventures — under three hours, zero awkward small talk, infinite stories.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/quests" className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-3 font-semibold shadow-[0_0_40px_-8px_var(--mint)] hover:opacity-90 transition">
                Browse tonight's quests
              </Link>
              <Link to="/how-it-works" className="rounded-full border border-border bg-card/60 px-6 py-3 font-semibold hover:border-primary transition">
                How it works
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div><span className="text-foreground font-bold text-2xl">12k+</span><br/>questers</div>
              <div className="h-10 w-px bg-border" />
              <div><span className="text-foreground font-bold text-2xl">3.2k</span><br/>quests/month</div>
              <div className="h-10 w-px bg-border" />
              <div><span className="text-foreground font-bold text-2xl">4.9★</span><br/>rated</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary/30 to-accent/20 blur-3xl rounded-full" />
            <img
              src={heroImg}
              alt="Friends laughing on a city adventure at dusk"
              width={1536}
              height={1024}
              className="relative rounded-3xl border border-border shadow-2xl"
            />
          </div>
        </section>

        {/* Bento */}
        <section className="py-16">
          <div className="flex items-end justify-between mb-10">
            <h2 className="text-4xl md:text-5xl font-bold max-w-xl">Small adventures.<br/><span className="text-gradient-mint">Big stories.</span></h2>
            <p className="hidden md:block text-muted-foreground max-w-sm">Everything you need to turn a Tuesday night into the story you'll tell on Friday.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[220px]">
            <div className="bento-card bento-card-hover p-7 md:row-span-2 md:col-span-2 relative overflow-hidden">
              <img src={mapImg} alt="Map of nearby quests" loading="lazy" width={1024} height={1024}
                className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity" />
              <div className="relative z-10 h-full flex flex-col justify-end">
                <MapPin className="size-7 text-primary mb-3" />
                <h3 className="text-3xl font-bold mb-2">Hyperlocal by design</h3>
                <p className="text-muted-foreground max-w-md">Every quest is within 15 minutes of you. No commutes, no excuses.</p>
              </div>
            </div>

            <div className="bento-card bento-card-hover p-7">
              <Clock className="size-7 text-primary mb-3" />
              <h3 className="text-xl font-bold mb-1">Under 3 hours</h3>
              <p className="text-sm text-muted-foreground">Real life still happens. Quests fit between dinner and bedtime.</p>
            </div>

            <div className="bento-card bento-card-hover p-7">
              <Users className="size-7 text-primary mb-3" />
              <h3 className="text-xl font-bold mb-1">Tiny groups</h3>
              <p className="text-sm text-muted-foreground">2–6 people. Big enough for energy, small enough for actual conversation.</p>
            </div>

            <div className="bento-card bento-card-hover p-7 md:col-span-2 relative overflow-hidden">
              <img src={connectImg} alt="Two people high-fiving" loading="lazy" width={1024} height={1024}
                className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
              <div className="relative z-10 max-w-sm">
                <Zap className="size-7 text-primary mb-3" />
                <h3 className="text-2xl font-bold mb-2">Show up, click instantly</h3>
                <p className="text-muted-foreground">Our match score blends interests, vibe, and shared weirdness so the chemistry is there before you say hi.</p>
              </div>
            </div>

            <div className="bento-card bento-card-hover p-7">
              <Coffee className="size-7 text-primary mb-3" />
              <h3 className="text-xl font-bold mb-1">Any vibe</h3>
              <p className="text-sm text-muted-foreground">Coffee crawls, kayak races, bookstore scavenger hunts, karaoke dives.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="bento-card p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-[500px] bg-primary/20 blur-3xl rounded-full" />
            <div className="relative">
              <h2 className="text-4xl md:text-6xl font-bold mb-4">Tonight is just sitting there.</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">Pick a quest. Meet two strangers who won't be strangers by 10pm.</p>
              <Link to="/quests" className="inline-flex rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-4 font-semibold text-lg shadow-[0_0_60px_-10px_var(--mint)] hover:opacity-90 transition">
                Find a quest →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
