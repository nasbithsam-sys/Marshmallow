import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile, NavigationPermission } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole;
  permissions: NavigationPermission[];
  loading: boolean;
  signOut: () => Promise<void>;
  canAccess: (navItem: string) => boolean;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>('no_role');
  const [permissions, setPermissions] = useState<NavigationPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});

  const fetchUserData = async (userId: string) => {
    const [profileRes, roleRes, permRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
      supabase.from('navigation_permissions').select('*').eq('user_id', userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (roleRes.data) setRole(roleRes.data.role as AppRole);
    else setRole('no_role');
    if (permRes.data) setPermissions(permRes.data as NavigationPermission[]);
  };

  const refetchProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRole('no_role');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole('no_role');
  };

  const canAccess = (navItem: string): boolean => {
    if (role === 'admin') return true;
    if (navItem in userOverrides) return userOverrides[navItem];
    return permissions.some(
      (p: any) => p.role === role && p.nav_item === navItem && p.allowed
    );
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, permissions, loading, signOut, canAccess, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};