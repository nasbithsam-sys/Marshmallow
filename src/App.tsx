import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import LeadsPage from "@/pages/LeadsPage";
import LeadDetailPage from "@/pages/LeadDetailPage";
import SchedulePage from "@/pages/SchedulePage";
import Analytics from "@/pages/Analytics";
import AreasPage from "@/pages/AreasPage";
import ActivityLogs from "@/pages/ActivityLogs";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import CallsPage from "@/pages/CallsPage";
import LeadCancellationRequests from "@/pages/LeadCancellationRequests";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoutes() {
  const { fullyAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!fullyAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

function LoginRoute() {
  const { loading, fullyAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  if (fullyAuthenticated) {
    return <Navigate to="/leads" replace />;
  }

  return <Login />;
}

function PageRoute({ navItem, children }: { navItem: string; children: ReactNode }) {
  const { canAccess, profileLoaded } = useAuth();

  if (!profileLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!canAccess(navItem)) {
    return <Navigate to="/leads" replace />;
  }

  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<ProtectedRoutes />}>
              <Route index element={<Navigate to="/leads" replace />} />
              <Route path="leads" element={<PageRoute navItem="leads"><LeadsPage /></PageRoute>} />
              <Route path="leads/:id" element={<PageRoute navItem="leads"><LeadDetailPage /></PageRoute>} />
              <Route path="schedule" element={<PageRoute navItem="schedule"><SchedulePage /></PageRoute>} />
              <Route path="analytics" element={<PageRoute navItem="analytics"><Analytics /></PageRoute>} />
              <Route path="areas" element={<PageRoute navItem="areas"><AreasPage /></PageRoute>} />
              <Route path="activity-logs" element={<PageRoute navItem="activity_logs"><ActivityLogs /></PageRoute>} />
              <Route path="calls" element={<PageRoute navItem="calls"><CallsPage /></PageRoute>} />
              <Route path="lead-cancellation-requests" element={<PageRoute navItem="cancellation_requests"><LeadCancellationRequests /></PageRoute>} />
              <Route path="settings" element={<PageRoute navItem="settings"><Settings /></PageRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
