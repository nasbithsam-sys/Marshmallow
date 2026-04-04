import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { canAccessNavItem } from '@/lib/access';

export const useNavPermissions = () => {
  const { user, role } = useAuth();

  const { data: permissions = [] } = useQuery({
    queryKey: ['nav-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('navigation_permissions')
        .select('*')
        .eq('user_id', user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const canAccess = (section: string): boolean => {
    return canAccessNavItem(role, section, permissions as any);
  };

  return { canAccess, permissions };
};
