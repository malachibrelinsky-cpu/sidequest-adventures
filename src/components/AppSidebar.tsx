import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, MessageSquare, Map, Trophy, Settings, Newspaper, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; authOnly?: boolean; badge?: string };

const items: Item[] = [
  { title: "Map", url: "/", icon: Map },
  { title: "Sidequests", url: "/quests", icon: Compass },
  { title: "Feed", url: "/feed", icon: Newspaper },
  { title: "Messages", url: "/messages", icon: MessageSquare, authOnly: true },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy, authOnly: true },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const [isMod, setIsMod] = useState(false);

  useEffect(() => {
    if (!user) { setIsMod(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r) => r.role);
      setIsMod(roles.includes("admin") || roles.includes("moderator"));
    });
  }, [user]);

  const isActive = (url: string) => currentPath === url || currentPath.startsWith(url + "/");

  const visible = items.filter((i) => {
    if (i.authOnly && !user) return false;
    if (i.premiumHide && isPremium) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="size-8 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center glow-border shrink-0">
            <Compass className="size-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed && <span className="font-display font-bold text-lg tracking-tight">SideQuest</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const premium = item.title === "Go Premium";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className={`size-4 ${premium ? "text-primary" : ""}`} />
                        {!collapsed && (
                          <span className={`flex-1 ${premium ? "font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" : ""}`}>
                            {item.title}
                          </span>
                        )}
                        {!collapsed && item.badge && (
                          <span className="text-[10px] uppercase tracking-wider rounded bg-primary/20 text-primary px-1.5 py-0.5 font-bold">{item.badge}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isMod && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/moderation")} tooltip="Moderation">
                    <Link to="/moderation" className="flex items-center gap-2">
                      <ShieldCheck className="size-4" />
                      {!collapsed && <span>Moderation</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
