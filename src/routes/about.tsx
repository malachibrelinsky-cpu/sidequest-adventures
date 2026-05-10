import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SideQuest" },
      { name: "description", content: "We started SideQuest because adulthood made meeting people weird. It shouldn't be." },
      { property: "og:title", content: "About — SideQuest" },
      { property: "og:description", content: "We started SideQuest because adulthood made meeting people weird." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-primary font-semibold text-sm mb-3">OUR STORY</p>
        <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-[0.95]">We believe the best stories happen <span className="text-gradient-mint">on a Tuesday</span>.</h1>
        <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
          <p>SideQuest started in 2024 in a Brooklyn apartment, after our founders realized they hadn't met a new friend in two years. Not because the city ran out of people — because adulthood made it weird to ask.</p>
          <p>So we built the app we wanted: short, low-stakes, in-person plans. Less <em>will-this-be-my-future-spouse</em>, more <em>let's-go-find-the-best-dumpling-in-this-zip-code</em>.</p>
          <p>Today, 12,000+ questers across 24 cities use SideQuest to fill their week with the kind of small, weird, lovely outings that turn neighborhoods into communities.</p>
          <p className="text-foreground font-semibold">Go outside. Bring snacks. Make a friend.</p>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-5">
          {[
            { k: "12k+", v: "Questers" },
            { k: "24", v: "Cities" },
            { k: "47k", v: "Quests completed" },
          ].map((s) => (
            <div key={s.v} className="bento-card p-6 text-center">
              <div className="text-4xl font-bold text-gradient-mint mb-1">{s.k}</div>
              <div className="text-sm text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
