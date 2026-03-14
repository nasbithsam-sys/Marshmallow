import { Users, BarChart3, Settings, ScrollText, Calendar, LogOut, Wrench, MapPin } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABELS, STATUS_DOT_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
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
import { motion } from "framer-motion";

const navItems = [
  { title: "All Leads", url: "/leads", icon: Users, navKey: "leads" },
  { title: "Lead Map", url: "/map", icon: MapPin, navKey: "map" },
  { title: "Schedule", url: "/schedule", icon: Calendar, navKey: "schedule" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, navKey: "analytics" },
  { title: "Area Insights", url: "/areas", icon: MapPin, navKey: "areas" },
  { title: "Activity Logs", url: "/activity-logs", icon: ScrollText, navKey: "activity_logs" },
  { title: "Settings", url: "/settings", icon: Settings, navKey: "settings" },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, role, signOut, canAccess } = useAuth();
  const { allowedStatuses } = useAllowedStatuses();

  const visibleItems = navItems.filter((item) => canAccess(item.navKey));

  const visibleStatuses = ALL_LEAD_STATUSES.filter((status) => allowedStatuses.has(status));

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const rawCurrentStatus = new URLSearchParams(location.search).get("status");
  const currentStatus = rawCurrentStatus && allowedStatuses.has(rawCurrentStatus) ? rawCurrentStatus : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(260,75%,58%)] text-primary-foreground shadow-brand"
          >
            <Wrench className="h-4.5 w-4.5" />
          </motion.div>

          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">Lead CRM</span>
              <span className="text-[10px] font-medium capitalize text-sidebar-foreground/35 tracking-wide">
                {role?.replace("_", " ")}
              </span>
            </motion.div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="opacity-30" />

      <SidebarContent className="overflow-y-auto">
        <ScrollArea className="flex-1">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/25 font-semibold px-3 mb-1">
              Navigation
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.url) && !currentStatus;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={`group/nav relative rounded-lg px-3 py-2 transition-all duration-200 hover:bg-sidebar-accent/60 ${
                            isActive ? "bg-sidebar-accent shadow-premium-xs" : ""
                          }`}
                          activeClassName="text-sidebar-accent-foreground font-semibold"
                        >
                          <item.icon
                            className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
                              isActive
                                ? "text-primary"
                                : "text-sidebar-foreground/40 group-hover/nav:text-sidebar-foreground/70"
                            }`}
                          />

                          {!collapsed && <span className="text-[13px] tracking-[-0.01em]">{item.title}</span>}

                          {isActive && !collapsed && (
                            <motion.div
                              layoutId="nav-active-indicator"
                              className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-primary"
                              transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {canAccess("leads") && !collapsed && visibleStatuses.length > 0 && (
            <>
              <SidebarSeparator className="opacity-30" />

              <SidebarGroup>
                <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/25 font-semibold px-3 mb-1">
                  By Status
                </SidebarGroupLabel>

                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleStatuses.map((status) => (
                      <SidebarMenuItem key={status}>
                        <SidebarMenuButton asChild isActive={currentStatus === status} tooltip={STATUS_LABELS[status]}>
                          <NavLink
                            to={`/leads?status=${status}`}
                            className="group/status flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 hover:bg-sidebar-accent/50"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[status]} transition-transform duration-200 group-hover/status:scale-125`}
                            />
                            <span className="text-[12px] truncate tracking-[-0.005em]">{STATUS_LABELS[status]}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarSeparator className="mb-3 opacity-30" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-sidebar-accent">
            <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(260,75%,58%)] text-primary-foreground text-[10px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-[13px] font-semibold text-sidebar-accent-foreground tracking-[-0.01em]">
                {profile?.full_name}
              </span>
              <span className="truncate text-[10px] text-sidebar-foreground/35">{profile?.email}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/25 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
