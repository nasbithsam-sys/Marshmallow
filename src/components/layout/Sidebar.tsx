import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutList, BarChart3, Settings, Activity, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavPermissions } from '@/hooks/useNavPermissions';

const Sidebar = () => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccess } = useNavPermissions();

  const navItems = [
    { path: '/', label: 'All Leads', icon: LayoutList, section: 'all_leads', alwaysVisible: true },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, section: 'analytics', alwaysVisible: false },
    { path: '/settings', label: 'Settings', icon: Settings, section: 'settings', alwaysVisible: false },
    { path: '/activity-logs', label: 'Activity Logs', icon: Activity, section: 'activity_logs', alwaysVisible: false },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.alwaysVisible) return true;
    if (item.section === 'settings') return role === 'admin';
    return canAccess(item.section);
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-sidebar-background text-sidebar-foreground flex flex-col z-50">
      {/* Logo / Brand */}
      <div className="px-6 py-6 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold tracking-tight">Lead CRM</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User info + Sign out */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 mb-3">
          <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
          <p className="text-xs text-sidebar-foreground/50 capitalize">{role.replace('_', ' ')}</p>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
