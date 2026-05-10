import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Clock, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/quests")({
  head: () => ({
    meta: [
      { title: "Browse Quests — SideQuest" },
      { name: "description", content: "Browse tonight's local side quests. Coffee crawls, sunset hikes, trivia nights and more — all under 3 hours." },
      { property: "og:title", content: "Browse Quests — SideQuest" },
      { property: "og:description", content: "Tonight's local adventures, ready to join." },
    ],
  }),
  component: Quests,
});

const QUESTS = [
  { title: "Sunset Bridge Walk", host: "Maya", category: "Outdoors", time: "Tonight · 7:30pm", duration: "90 min", spots: "3 of 5 spots", area: "Mission District", emoji: "🌅" },
  { title: "Vinyl Crate Digging", host: "Theo", category: "Music", time: "Sat · 2:00pm", duration: "2 hrs", spots: "2 of 4 spots", area: "Lower Haight", emoji: "🎧" },
  { title: "Late-Night Ramen Crawl", host: "Priya", category: "Food", time: "Fri · 9:00pm", duration: "2.5 hrs", spots: "4 of 6 spots", area: "Japantown", emoji: "🍜" },
  { title: "Bookstore Scavenger Hunt", host: "Jules", category: "Nerdy", time: "Sun · 11:00am", duration: "2 hrs", spots: "1 of 4 spots", area: "Hayes Valley", emoji: "📚" },
  { title: "Kayak & Coffee", host: "Marcus", category: "Outdoors", time: "Sat · 8:00am", duration: "3 hrs", spots: "2 of 4 spots", area: "Embarcadero", emoji: "🛶" },
  { title: "Pub Trivia Underdogs", host: "Sam", category: "Social", time: "Tue · 7:00pm", duration: "2 hrs", spots: "1 of 4 spots", area: "North Beach", emoji: "🍻" },
];

function Quests() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 max-w-2xl">
          <p className="text-primary font-semibold text-sm mb-3">QUEST BOARD</p>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">What's happening near you.</h1>
          <p className="text-lg text-muted-foreground">Hand-picked, locally hosted, never longer than an evening. Click any quest to RSVP.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "Outdoors", "Food", "Music", "Social", "Nerdy"].map((c, i) => (
            <button key={c} className={`px-4 py-2 rounded-full text-sm font-medium border transition ${i === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary"}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {QUESTS.map((q) => (
            <article key={q.title} className="bento-card bento-card-hover p-6 flex flex-col cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 grid place-items-center text-3xl">{q.emoji}</div>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{q.category}</span>
              </div>
              <h3 className="text-xl font-bold mb-1">{q.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">Hosted by {q.host}</p>
              <div className="space-y-2 text-sm text-muted-foreground mt-auto">
                <div className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {q.time} · {q.duration}</div>
                <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {q.area}</div>
                <div className="flex items-center gap-2"><Users className="size-4 text-primary" /> {q.spots}</div>
              </div>
              <button className="mt-5 w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-semibold text-sm hover:opacity-90 transition">
                Join quest
              </button>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
