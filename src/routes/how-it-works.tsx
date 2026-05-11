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
  { n: "01", title: "Set your vibe", body: "Two minutes. Pick interests, energy level, and your city — Quan, our AI guide, uses this to surface quests that fit you." },
  { n: "02", title: "Browse the feed or post a sidequest", body: "Scroll the feed for photo posts and quest invites, or post your own sidequest with the time, location, points, and how many people you want along." },
  { n: "03", title: "Tap 'Accept Quest' to join the crew", body: "Accepting an invite drops you into a private group chat with everyone else who joined. Coordinate, hype each other up, show up." },
  { n: "04", title: "Quest leader marks it complete", body: "Whoever posted the invite uploads photo or video evidence with the crew. Quan screens it to confirm everyone showed up and actually did the thing." },
  { n: "05", title: "Points auto-awarded to everyone", body: "Once Quan approves, every participant — including the leader — is automatically awarded the quest's points. Keep your daily streak for a multiplier and climb the worldwide or private-league leaderboard." },
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
