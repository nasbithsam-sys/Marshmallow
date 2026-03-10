import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { AppRole } from '@/types';

const NAV_SECTIONS = ['analytics', 'activity_logs'];

const Settings = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('no_role');
  const [creating, setCreating] = useState(false);

  // Fetch users with roles
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

  // Fetch nav permissions
  const { data: permissions = [] } = useQuery({
    queryKey: ['settings-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('navigation_permissions').select('*');
      return data ?? [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Upsert role
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

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

  const togglePermission = useMutation({
    mutationFn: async ({ userId, section, allowed }: { userId: string; section: string; allowed: boolean }) => {
      const existing = permissions.find((p: any) => p.user_id === userId && p.nav_section === section);
      if (existing) {
        await supabase.from('navigation_permissions').update({ allowed }).eq('id', (existing as any).id);
      } else {
        await supabase.from('navigation_permissions').insert({ user_id: userId, nav_section: section, allowed });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-permissions'] });
    },
  });

  const handleCreateUser = async () => {
    setCreating(true);
    // Use Supabase admin invite (requires service role on backend)
    // For now, use signUp which works with anon key
    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { full_name: newName } },
    });

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    if (data.user) {
      // Insert profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: newName,
        email: newEmail,
      });
      // Insert role
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: newRole,
      });
    }

    toast.success('User created');
    setCreateOpen(false);
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setNewRole('no_role');
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ['settings-users'] });
  };

  const getPermission = (userId: string, section: string) => {
    const perm = permissions.find((p: any) => p.user_id === userId && p.nav_section === section);
    return (perm as any)?.allowed ?? false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <Button onClick={() => setCreateOpen(true)}>Create User</Button>
      </div>

      {/* Users table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {NAV_SECTIONS.map(s => (
                <TableHead key={s} className="text-center capitalize">{s.replace('_', ' ')}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={v => updateRole.mutate({ userId: u.id, role: v as AppRole })}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="processor">Processor</SelectItem>
                      <SelectItem value="customer_service">Customer Service</SelectItem>
                      <SelectItem value="no_role">No Role</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                {NAV_SECTIONS.map(section => (
                  <TableCell key={section} className="text-center">
                    <Switch
                      checked={u.role === 'admin' || getPermission(u.id, section)}
                      disabled={u.role === 'admin'}
                      onCheckedChange={checked => togglePermission.mutate({ userId: u.id, section, allowed: checked })}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
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
