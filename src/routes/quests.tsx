import { createFileRoute } from "@tanstack/react-router";
import { Route as FeedRoute } from "./feed";

export const Route = createFileRoute("/quests")({
  head: () => ({
    meta: [
      { title: "Sidequests — SideQuest" },
      { name: "description", content: "Browse joinable sidequests near you." },
    ],
    links: [{ rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" }],
  }),
  component: FeedRoute.options.component,
});
