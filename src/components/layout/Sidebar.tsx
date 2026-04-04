import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutList, BarChart3, Settings, Activity, LogOut, Zap } from 'lucide-react';
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

  const initials = (profile?.full_name ?? 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-sidebar text-sidebar-foreground flex flex-col z-50">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-sidebar-border flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
          <Zap className="h-4 w-4 text-brand-foreground" />
        </div>
        <h1 className="text-base font-semibold tracking-tight">Lead CRM</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand" />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User info + Sign out */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-foreground shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
            <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              {role.replace('_', ' ')}
            </span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
