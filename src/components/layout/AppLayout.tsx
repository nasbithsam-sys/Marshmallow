import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants } from "@/lib/motion";

export default function AppLayout() {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/40 glass-strong px-5 gap-4 shrink-0 sticky top-0 z-30">
            <SidebarTrigger className="hover:bg-accent rounded-lg transition-colors duration-200" />
            <div className="h-4 w-px bg-border/40" />
            <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] flex-1">Lead CRM</span>
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-5 md:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
