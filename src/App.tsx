import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import LeadsPage from "@/pages/LeadsPage";
import LeadDetailPage from "@/pages/LeadDetailPage";
import SchedulePage from "@/pages/SchedulePage";
import Analytics from "@/pages/Analytics";
import AreasPage from "@/pages/AreasPage";
import MapPage from "@/pages/MapPage";
import ActivityLogs from "@/pages/ActivityLogs";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { fullyAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
  if (!fullyAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function LoginRoute() {
  const { loading, fullyAuthenticated } = useAuth();
  if (loading) return null;
  if (fullyAuthenticated) return <Navigate to="/leads" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<ProtectedRoutes />}>
              <Route index element={<Navigate to="/leads" replace />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<LeadDetailPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="areas" element={<AreasPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="activity-logs" element={<ActivityLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;