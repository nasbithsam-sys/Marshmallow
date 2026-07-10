import { useAuth } from '@/contexts/AuthContext';

/**
 * Thin wrapper around AuthContext for nav-permission checks. AuthContext already
 * loads `navigation_permissions` once per session, so re-querying here would
 * duplicate work and risk drift when Settings mutates permissions.
 */
export const useNavPermissions = () => {
  const { permissions, canAccess } = useAuth();
  return { canAccess, permissions };
};
