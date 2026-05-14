import { createFileRoute } from "@tanstack/react-router";
import { FeedPage } from "./feed";

export const Route = createFileRoute("/quests")({
  head: () => ({
    meta: [
      { title: "Browse Sidequests Near You — SideQuest" },
      { name: "description", content: "Browse joinable sidequests near you tonight — coffee crawls, sunset hikes, trivia nights, and short adventures with locals under three hours." },
      { property: "og:title", content: "Browse Sidequests Near You — SideQuest" },
      { property: "og:description", content: "Find tonight's joinable sidequests within 15 minutes of you. Tiny groups, big stories." },
    ],
    links: [{ rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" }],
  }),
  component: FeedPage,
});
