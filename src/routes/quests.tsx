import { createFileRoute } from "@tanstack/react-router";
import { Route as FeedRoute } from "./feed";

export const Route = createFileRoute("/quests")({
  head: () => ({ meta: [{ title: "Sidequests — SideQuest" }, { name: "description", content: "Browse joinable sidequests near you." }] }),
  component: FeedRoute.options.component,
});
