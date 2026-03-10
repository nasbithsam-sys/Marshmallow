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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/40 glass-strong px-4 gap-4 shrink-0 sticky top-0 z-30">
            <SidebarTrigger className="hover:bg-accent transition-all duration-200 rounded-lg" />
            <div className="h-5 w-px bg-border/40" />
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex-1">Lead CRM</span>
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8">
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
