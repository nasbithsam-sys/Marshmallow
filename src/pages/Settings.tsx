import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Shield, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_LEAD_STATUSES, STATUS_LABELS, ALL_NAV_ITEMS } from '@/lib/constants';
import type { AppRole } from '@/types';

const NAV_SECTION_LABELS: Record<string, string> = {
  leads: 'All Leads',
  analytics: 'Analytics',
  settings: 'Settings',
  activity_logs: 'Activity Logs',
  schedule: 'Schedule',
  map: 'Lead Map',
  areas: 'Area Insights',
};

const roleColors: Record<string, string> = {
  admin: 'bg-blue-50 text-blue-700',
  processor: 'bg-green-50 text-green-700',
  customer_service: 'bg-amber-50 text-amber-700',
  no_role: 'bg-muted text-muted-foreground',
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('no_role');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'nav_permissions' | 'status_permissions'>('users');

  const { data: users = [] } = useQuery({
    queryKey: ['settings-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role ?? 'no_role',
      }));
    },
  });

  const { data: navPermissions = [] } = useQuery({
    queryKey: ['settings-nav-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('navigation_permissions').select('*');
      return data ?? [];
    },
  });

  const { data: statusPermissions = [] } = useQuery({
    queryKey: ['settings-status-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('status_permissions').select('*');
      return data ?? [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).single();
      if (existing) {
        await supabase.from('user_roles').update({ role }).eq('user_id', userId);
      } else {
        await supabase.from('user_roles').insert({ user_id: userId, role });
      }
    },
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const toggleNavPermission = useMutation({
    mutationFn: async ({ userId, section, allowed }: { userId: string; section: string; allowed: boolean }) => {
      const existing = navPermissions.find((p: any) => p.user_id === userId && p.nav_section === section);
      if (existing) {
        await supabase.from('navigation_permissions').update({ allowed }).eq('id', (existing as any).id);
      } else {
        await supabase.from('navigation_permissions').insert({ user_id: userId, nav_section: section, allowed });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-nav-permissions'] });
    },
  });

  const toggleStatusPermission = useMutation({
    mutationFn: async ({ userId, status, allowed }: { userId: string; status: string; allowed: boolean }) => {
      const existing = statusPermissions.find((p: any) => p.user_id === userId && p.status === status);
      if (existing) {
        await supabase.from('status_permissions').update({ allowed }).eq('id', (existing as any).id);
      } else {
        await supabase.from('status_permissions').insert({ user_id: userId, status, allowed });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-status-permissions'] });
    },
  });

  const handleCreateUser = async () => {
    setCreating(true);
    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { full_name: newName } },
    });
    if (error) { toast.error(error.message); setCreating(false); return; }
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, full_name: newName, email: newEmail });
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: newRole });
    }
    toast.success('User created');
    setCreateOpen(false);
    setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('no_role');
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ['settings-users'] });
  };

  const getNavPermission = (userId: string, section: string) => {
    const perm = navPermissions.find((p: any) => p.user_id === userId && p.nav_section === section);
    return (perm as any)?.allowed ?? false;
  };

  const getStatusPermission = (userId: string, status: string) => {
    const perm = statusPermissions.find((p: any) => p.user_id === userId && p.status === status);
    return (perm as any)?.allowed ?? true; // Default to allowed
  };

  const getInitials = (name: string) =>
    name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const nonAdminUsers = users.filter((u: any) => u.role !== 'admin');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users, navigation, and status permissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'users', label: 'Users' },
          { key: 'nav_permissions', label: 'Tab Permissions' },
          { key: 'status_permissions', label: 'Status Permissions' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="grid gap-3">
          {users.map((u: any) => (
            <Card key={u.id} className="border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                  {getInitials(u.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium capitalize', roleColors[u.role] || roleColors.no_role)}>
                  {u.role.replace('_', ' ')}
                </span>
                <Select value={u.role} onValueChange={v => updateRole.mutate({ userId: u.id, role: v as AppRole })}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="processor">Processor</SelectItem>
                    <SelectItem value="customer_service">Customer Service</SelectItem>
                    <SelectItem value="no_role">No Role</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tab/Nav Permissions */}
      {activeTab === 'nav_permissions' && (
        <Card className="border">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Navigation Access per User</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">User</th>
                    {ALL_NAV_ITEMS.map(section => (
                      <th key={section} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">
                        {NAV_SECTION_LABELS[section] || section}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonAdminUsers.map((u: any) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{u.full_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{u.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      {ALL_NAV_ITEMS.map(section => (
                        <td key={section} className="px-3 py-3 text-center">
                          <Switch
                            checked={getNavPermission(u.id, section)}
                            onCheckedChange={checked => toggleNavPermission.mutate({ userId: u.id, section, allowed: checked })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Permissions */}
      {activeTab === 'status_permissions' && (
        <Card className="border">
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Status Visibility per User</span>
              <span className="text-[10px] text-muted-foreground ml-2">(Which statuses each user can see/use)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10">User</th>
                    {ALL_LEAD_STATUSES.map(status => (
                      <th key={status} className="px-2 py-2 text-[9px] font-semibold text-muted-foreground text-center min-w-[80px]">
                        {STATUS_LABELS[status]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonAdminUsers.map((u: any) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{u.full_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{u.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      {ALL_LEAD_STATUSES.map(status => (
                        <td key={status} className="px-2 py-3 text-center">
                          <Switch
                            checked={getStatusPermission(u.id, status)}
                            onCheckedChange={checked => toggleStatusPermission.mutate({ userId: u.id, status, allowed: checked })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="processor">Processor</SelectItem>
                  <SelectItem value="customer_service">Customer Service</SelectItem>
                  <SelectItem value="no_role">No Role</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creating || !newEmail || !newPassword || !newName}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
