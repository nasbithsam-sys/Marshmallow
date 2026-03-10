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

  const visibleItems = navItems.filter((item) => canAccess(item.navKey));
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const currentStatus = new URLSearchParams(location.search).get("status");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(250,80%,60%)] text-primary-foreground shadow-brand"
          >
            <Wrench className="h-5 w-5" />
          </motion.div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">Lead CRM</span>
              <span className="text-[11px] font-medium capitalize text-sidebar-foreground/40">
                {role?.replace("_", " ")}
              </span>
            </motion.div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="opacity-50" />

      <SidebarContent className="overflow-y-auto">
        <ScrollArea className="flex-1">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/30 font-semibold px-3">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item, i) => {
                  const isActive = location.pathname.startsWith(item.url) && !currentStatus;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <NavLink
                          to={item.url}
                          className={`group/nav rounded-xl px-3 py-2 transition-all duration-200 hover:bg-sidebar-accent/80 ${
                            isActive ? 'bg-gradient-to-r from-primary/20 to-primary/5 shadow-sm' : ''
                          }`}
                          activeClassName="text-sidebar-accent-foreground font-semibold"
                        >
                          <item.icon className={`h-4 w-4 shrink-0 transition-all duration-200 ${
                            isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover/nav:text-sidebar-foreground/80'
                          }`} />
                          {!collapsed && (
                            <span className="text-[13px]">{item.title}</span>
                          )}
                          {isActive && !collapsed && (
                            <motion.div
                              layoutId="nav-active-indicator"
                              className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
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

          {/* Status filter section */}
          {canAccess("leads") && !collapsed && (
            <>
              <SidebarSeparator className="opacity-50" />
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/30 font-semibold px-3">
                  By Status
                </SidebarGroupLabel>
                <SidebarGroupContent>
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
                            className="group/status flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-all duration-200 hover:bg-sidebar-accent/60"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[status]} transition-all group-hover/status:scale-125`} />
                            <span className="text-[12px] truncate">{STATUS_LABELS[status]}</span>
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
        <SidebarSeparator className="mb-3 opacity-50" />
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-sidebar-accent shadow-premium-sm">
            <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(250,80%,60%)] text-primary-foreground text-[11px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">
                {profile?.full_name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/40">
                {profile?.email}
              </span>
            </div>
          )}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
