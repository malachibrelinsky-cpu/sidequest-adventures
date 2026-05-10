import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/quests")({
  beforeLoad: () => { throw redirect({ to: "/feed" }); },
});
