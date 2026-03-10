import {
  Users, BarChart3, Settings, ScrollText, Calendar, LogOut, Wrench, MapPin,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABELS, STATUS_DOT_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import type { LeadStatus } from "@/lib/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { title: "All Leads", url: "/leads", icon: Users, navKey: "leads" },
  { title: "Lead Map", url: "/map", icon: MapPin, navKey: "leads" },
  { title: "Schedule", url: "/schedule", icon: Calendar, navKey: "schedule" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, navKey: "analytics" },
  { title: "Area Insights", url: "/areas", icon: MapPin, navKey: "analytics" },
  { title: "Activity Logs", url: "/activity-logs", icon: ScrollText, navKey: "activity_logs" },
  { title: "Settings", url: "/settings", icon: Settings, navKey: "settings" },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, role, signOut, canAccess } = useAuth();

  const visibleItems = navItems.filter((item) => canAccess(item.navKey));
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const currentStatus = new URLSearchParams(location.search).get("status");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-[hsl(263,70%,58%)] text-white shadow-lg shadow-sidebar-primary/25">
            <Wrench className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">Lead CRM</span>
              <span className="text-[11px] font-medium capitalize text-sidebar-foreground/50">
                {role?.replace("_", " ")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.url) && !currentStatus}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      className="group/nav rounded-lg px-3 py-2 transition-all duration-150 hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                      {!collapsed && <span className="text-[13px]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Status filter section */}
        {canAccess("leads") && !collapsed && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
                By Status
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <ScrollArea className="max-h-[calc(100vh-320px)]">
                  <SidebarMenu>
                    {ALL_LEAD_STATUSES.map((status) => (
                      <SidebarMenuItem key={status}>
                        <SidebarMenuButton
                          asChild
                          isActive={currentStatus === status}
                          tooltip={STATUS_LABELS[status]}
                        >
                          <NavLink
                            to={`/leads?status=${status}`}
                            className="group/status flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-150 hover:bg-sidebar-accent/60"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[status]} ring-2 ring-transparent transition-all group-hover/status:ring-current/20`} />
                            <span className="text-[12px] truncate">{STATUS_LABELS[status]}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </ScrollArea>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarSeparator className="mb-3" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-accent">
            <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-[hsl(263,70%,58%)] text-white text-[11px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
                {profile?.full_name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/50">
                {profile?.email}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}