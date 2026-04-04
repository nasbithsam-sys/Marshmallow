import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
<<<<<<< HEAD
import { canAccessNavItem } from '@/lib/access';
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

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
<<<<<<< HEAD
    return canAccessNavItem(role, section, permissions as any);
=======
    if (role === 'admin') return true;
    const perm = permissions.find((p: any) => p.nav_section === section);
    return perm?.allowed ?? false;
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  };

  return { canAccess, permissions };
};
