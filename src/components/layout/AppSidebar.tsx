import {
  Users,
  BarChart3,
  Settings,
  ScrollText,
  Calendar,
  LogOut,
  Wrench,
  MapPin,
  Sparkles,
  ChevronRight,
  ClipboardX,
  MessageSquare,
} from "lucide-react";
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
  { title: "Quo Monitor", url: "/quo-monitor", icon: MessageSquare, navKey: "quo_monitor" },
  { title: "Lead Cancellation Requests", url: "/lead-cancellation-requests", icon: ClipboardX, navKey: "cancellation_requests" },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/45 bg-[hsl(var(--sidebar-background)/0.8)]">
      <SidebarHeader className="p-4 pb-3">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="relative overflow-hidden rounded-[26px] border border-white/40 bg-[radial-gradient(circle_at_top_left,hsl(193_100%_87%/0.34),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(210_100%_88%/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.96),hsl(var(--sidebar-accent)/0.66))] p-3 shadow-[0_24px_44px_-28px_rgba(59,130,246,0.2)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,197,255,0.28),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.28),transparent_54%)]" />

          <div className="relative flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -3 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-[hsl(230,94%,66%)] to-[hsl(260,92%,70%)] text-primary-foreground shadow-[0_14px_32px_-12px_hsl(var(--primary)/0.65)] ring-1 ring-white/18"
              >
              <Wrench className="h-4.5 w-4.5" />
            </motion.div>

            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: 0.04 }}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold tracking-tight text-sidebar-accent-foreground">
                    Lead CRM
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/60">
                    <Sparkles className="h-2.5 w-2.5" />
                    Pro
                  </span>
                </div>

                <span className="mt-0.5 block text-[10px] font-medium capitalize tracking-[0.16em] text-sidebar-foreground/38">
                  {role?.replace("_", " ")}
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto px-2 pb-2">
        <ScrollArea className="flex-1">
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="mb-2 rounded-[18px] border border-white/36 bg-[radial-gradient(circle_at_top_left,hsl(193_100%_86%/0.2),transparent_34%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.9),hsl(var(--sidebar-accent)/0.62))] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/74 shadow-[0_16px_24px_-20px_rgba(59,130,246,0.16)]">
                Navigation
              </SidebarGroupLabel>
            )}

            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {visibleItems.map((item, index) => {
                  const isActive = location.pathname.startsWith(item.url) && !currentStatus;

                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.03 }}
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <NavLink
                            to={item.url}
                            className={`group/nav relative flex items-center rounded-[18px] border border-transparent px-3 py-2.5 transition-all duration-300 ${
                              isActive
                                ? "border-white/34 bg-[radial-gradient(circle_at_left,hsl(194_100%_88%/0.18),transparent_28%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.98),hsl(var(--sidebar-accent)/0.82))] text-sidebar-accent-foreground shadow-[0_18px_28px_-20px_rgba(59,130,246,0.18)] ring-1 ring-white/12"
                                : "hover:border-white/18 hover:bg-[linear-gradient(180deg,hsl(var(--sidebar-accent)/0.76),hsl(var(--sidebar-accent)/0.56))] hover:shadow-[0_12px_22px_-20px_rgba(59,130,246,0.12)]"
                            }`}
                            activeClassName="text-sidebar-accent-foreground"
                          >
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active-pill"
                                className="absolute inset-0 rounded-[18px] bg-gradient-to-r from-white/[0.10] via-white/[0.04] to-transparent"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}

                            <item.icon
                              className={`relative z-10 h-4 w-4 shrink-0 transition-all duration-200 ${
                                isActive
                                  ? "text-primary"
                                  : "text-sidebar-foreground/42 group-hover/nav:text-sidebar-foreground/78 group-hover/nav:scale-105"
                              }`}
                            />

                            {!collapsed && (
                              <>
                                <span className="relative z-10 ml-3 flex-1 text-[13px] font-medium tracking-[-0.01em]">
                                  {item.title}
                                </span>

                                <ChevronRight
                                  className={`relative z-10 h-3.5 w-3.5 transition-all duration-200 ${
                                    isActive
                                      ? "translate-x-0 text-sidebar-foreground/38"
                                      : "-translate-x-1 opacity-0 text-sidebar-foreground/25 group-hover/nav:translate-x-0 group-hover/nav:opacity-100"
                                  }`}
                                />
                              </>
                            )}

                            {isActive && !collapsed && (
                              <motion.div
                                layoutId="nav-active-indicator-dot"
                                className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.9)]"
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {canAccess("leads") && !collapsed && visibleStatuses.length > 0 && (
            <>
              <div className="my-3 px-2">
                <SidebarSeparator className="opacity-25" />
              </div>

              <SidebarGroup>
                <SidebarGroupLabel className="mb-2 rounded-[18px] border border-white/36 bg-[radial-gradient(circle_at_top_left,hsl(193_100%_86%/0.2),transparent_34%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.9),hsl(var(--sidebar-accent)/0.62))] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/74 shadow-[0_16px_24px_-20px_rgba(59,130,246,0.16)]">
                  By Status
                </SidebarGroupLabel>

                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {visibleStatuses.map((status, index) => (
                      <motion.div
                        key={status}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 + index * 0.015 }}
                      >
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={currentStatus === status}
                            tooltip={STATUS_LABELS[status]}
                          >
                            <NavLink
                              to={`/leads?status=${status}`}
                              className={`group/status relative flex items-center gap-2.5 rounded-[18px] border border-transparent px-3 py-2 transition-all duration-300 ${
                                currentStatus === status
                                  ? "border-white/34 bg-[radial-gradient(circle_at_left,hsl(194_100%_88%/0.14),transparent_28%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.96),hsl(var(--sidebar-accent)/0.76))] text-sidebar-accent-foreground shadow-[0_14px_24px_-20px_rgba(59,130,246,0.16)] ring-1 ring-white/10"
                                  : "hover:border-white/18 hover:bg-[linear-gradient(180deg,hsl(var(--sidebar-accent)/0.68),hsl(var(--sidebar-accent)/0.5))]"
                              }`}
                              activeClassName="text-sidebar-accent-foreground font-semibold"
                            >
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[status]} transition-all duration-200 group-hover/status:scale-125`}
                              />
                              <span className="truncate text-[12px] font-medium tracking-[-0.005em]">
                                {STATUS_LABELS[status]}
                              </span>

                              {currentStatus === status && (
                                <motion.div
                                  layoutId="status-active-pill"
                                  className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white/80"
                                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                />
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </motion.div>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-2">
        <div className="rounded-[24px] border border-white/36 bg-[radial-gradient(circle_at_top_left,hsl(194_100%_88%/0.2),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(210_100%_88%/0.14),transparent_32%),linear-gradient(180deg,hsl(var(--sidebar-accent)/0.9),hsl(var(--sidebar-accent)/0.58))] p-3 shadow-[0_18px_28px_-22px_rgba(59,130,246,0.16)]">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10 shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-primary via-[hsl(258,88%,64%)] to-[hsl(278,82%,62%)] text-primary-foreground text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-sidebar-accent-foreground">
                  {profile?.full_name}
                </span>
                <span className="block truncate text-[10px] text-sidebar-foreground/38">{profile?.email}</span>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-xl text-sidebar-foreground/28 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
