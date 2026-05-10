import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — SideQuest" },
      { name: "description", content: "Three steps from your couch to a brand new memory. Pick a quest, meet your crew, go." },
      { property: "og:title", content: "How it works — SideQuest" },
      { property: "og:description", content: "Three steps from couch to memory." },
    ],
  }),
  component: How,
});

const STEPS = [
  { n: "01", title: "Tell us your vibe", body: "Two minutes. Pick interests, energy level, and whether you're into mornings or moonlight." },
  { n: "02", title: "Pick a quest, or get matched", body: "Browse the board or let our algorithm slot you into something delightfully unexpected." },
  { n: "03", title: "Show up. Story unfolds.", body: "Meet your tiny crew at the spot. Three hours later, you've got a new friend and a great anecdote." },
];

function How() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-primary font-semibold text-sm mb-3">HOW IT WORKS</p>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[0.95]">From couch to <span className="text-gradient-mint">crew</span> in three steps.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-16">No swiping, no DMs, no maybe-next-week. Just a real plan with real people, tonight.</p>

        <div className="space-y-5">
          {STEPS.map((s) => (
            <div key={s.n} className="bento-card p-8 md:p-10 grid md:grid-cols-[120px_1fr] gap-6 items-start">
              <div className="text-6xl font-display font-bold text-gradient-mint">{s.n}</div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{s.title}</h2>
                <p className="text-muted-foreground text-lg">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link to="/quests" className="inline-flex rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-4 font-semibold text-lg shadow-[0_0_60px_-10px_var(--mint)] hover:opacity-90 transition">
            See tonight's quests →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
