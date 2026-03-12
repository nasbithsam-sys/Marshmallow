import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_LEAD_STATUSES } from '@/lib/constants';
import type { LeadStatus } from '@/types';

export function useAllowedStatuses() {
  const { user, role } = useAuth();

  const { data: allowedStatuses } = useQuery({
    queryKey: ['status-permissions', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>(ALL_LEAD_STATUSES);
      // Admins bypass
      if (role === 'admin') return new Set<string>(ALL_LEAD_STATUSES);

      const { data } = await supabase
        .from('status_permissions')
        .select('status, allowed')
        .eq('user_id', user.id);

      // Build a map of explicit permissions
      const explicitPerms = new Map<string, boolean>();
      if (data) {
        data.forEach((p: any) => explicitPerms.set(p.status, p.allowed));
      }

      // Default: if no row exists for a status, treat as allowed
      const allowed = new Set<string>();
      for (const s of ALL_LEAD_STATUSES) {
        const perm = explicitPerms.get(s);
        if (perm === false) continue; // explicitly denied
        allowed.add(s);
      }
      return allowed;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const allStatuses = new Set<string>(ALL_LEAD_STATUSES);
  const statuses = allowedStatuses ?? allStatuses;

  const filterLeads = <T extends { status: string }>(leads: T[]): T[] =>
    leads.filter(l => statuses.has(l.status));

  return { allowedStatuses: statuses, filterLeads };
}
