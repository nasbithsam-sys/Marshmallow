import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile, NavigationPermission } from "@/types";
<<<<<<< HEAD
import { canAccessNavItem } from "@/lib/access";
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

const VERIFIED_USER_KEY = "auth_verified_user_id";
const PENDING_AUTH_KEY = "auth_pending_state";

type PendingStep = "none" | "access_code" | "mfa";

interface PendingAuthState {
  step: PendingStep;
  userId: string | null;
  mfaFactorId?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole;
  permissions: NavigationPermission[];
  loading: boolean;
  fullyAuthenticated: boolean;
  pendingStep: PendingStep;
  pendingUserId: string | null;
  pendingMfaFactorId: string | null;
  signOut: () => Promise<void>;
  canAccess: (navItem: string) => boolean;
  refetchProfile: () => Promise<void>;
  markFullyAuthenticated: () => void;
  startPendingAccessCode: (userId: string) => void;
  startPendingMfa: (userId: string, factorId: string) => void;
  clearPendingAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>("no_role");
  const [permissions, setPermissions] = useState<NavigationPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOverrides] = useState<Record<string, boolean>>({});
  const [fullyAuthenticated, setFullyAuthenticated] = useState(false);
  const [pendingStep, setPendingStep] = useState<PendingStep>("none");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);

  const loadPendingFromStorage = (nextSession: Session | null) => {
    if (!nextSession?.user) {
      window.localStorage.removeItem(PENDING_AUTH_KEY);
      setPendingStep("none");
      setPendingUserId(null);
      setPendingMfaFactorId(null);
      return;
    }

    const raw = window.localStorage.getItem(PENDING_AUTH_KEY);
    if (!raw) {
      setPendingStep("none");
      setPendingUserId(null);
      setPendingMfaFactorId(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PendingAuthState;

      if (parsed.userId === nextSession.user.id && parsed.step !== "none") {
        setPendingStep(parsed.step);
        setPendingUserId(parsed.userId);
        setPendingMfaFactorId(parsed.mfaFactorId ?? null);
      } else {
        window.localStorage.removeItem(PENDING_AUTH_KEY);
        setPendingStep("none");
        setPendingUserId(null);
        setPendingMfaFactorId(null);
      }
    } catch {
      window.localStorage.removeItem(PENDING_AUTH_KEY);
      setPendingStep("none");
      setPendingUserId(null);
      setPendingMfaFactorId(null);
    }
  };

  const syncVerifiedState = (nextSession: Session | null) => {
    if (nextSession?.user) {
      const storedId = window.localStorage.getItem(VERIFIED_USER_KEY);
      setFullyAuthenticated(storedId === nextSession.user.id);
    } else {
      window.localStorage.removeItem(VERIFIED_USER_KEY);
      setFullyAuthenticated(false);
    }

    loadPendingFromStorage(nextSession);
  };

  const fetchUserData = async (userId: string) => {
    const [profileRes, roleRes, permRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      supabase.from("navigation_permissions").select("*").eq("user_id", userId),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as Profile);
    } else {
      setProfile(null);
    }

    if (roleRes.data) {
      setRole(roleRes.data.role as AppRole);
    } else {
      setRole("no_role");
    }

    if (permRes.data) {
      setPermissions(permRes.data as NavigationPermission[]);
    } else {
      setPermissions([]);
    }
  };

  const refetchProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => {
          void fetchUserData(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRole("no_role");
        setPermissions([]);
      }

      syncVerifiedState(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        void fetchUserData(initialSession.user.id);
      } else {
        setProfile(null);
        setRole("no_role");
        setPermissions([]);
      }

      syncVerifiedState(initialSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const persistPendingAuth = (state: PendingAuthState | null) => {
    if (!state || state.step === "none" || !state.userId) {
      window.localStorage.removeItem(PENDING_AUTH_KEY);
      setPendingStep("none");
      setPendingUserId(null);
      setPendingMfaFactorId(null);
      return;
    }

    window.localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(state));
    setPendingStep(state.step);
    setPendingUserId(state.userId);
    setPendingMfaFactorId(state.mfaFactorId ?? null);
  };

  const clearPendingAuth = () => {
    persistPendingAuth(null);
  };

  const startPendingAccessCode = (userId: string) => {
    window.localStorage.removeItem(VERIFIED_USER_KEY);
    setFullyAuthenticated(false);
    persistPendingAuth({ step: "access_code", userId, mfaFactorId: null });
  };

  const startPendingMfa = (userId: string, factorId: string) => {
    window.localStorage.removeItem(VERIFIED_USER_KEY);
    setFullyAuthenticated(false);
    persistPendingAuth({ step: "mfa", userId, mfaFactorId: factorId });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole("no_role");
    setPermissions([]);
    window.localStorage.removeItem(VERIFIED_USER_KEY);
    window.localStorage.removeItem(PENDING_AUTH_KEY);
    setFullyAuthenticated(false);
    setPendingStep("none");
    setPendingUserId(null);
    setPendingMfaFactorId(null);
  };

  const canAccess = (navItem: string): boolean => {
<<<<<<< HEAD
    if (navItem in userOverrides) return userOverrides[navItem];
    return canAccessNavItem(role, navItem, permissions);
=======
    if (role === "admin") return true;
    if (navItem in userOverrides) return userOverrides[navItem];

    return permissions.some((p: any) => p.nav_section === navItem && p.allowed);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  };

  const markFullyAuthenticated = () => {
    const currentUserId = user?.id ?? session?.user?.id;
    if (!currentUserId) return;

    window.localStorage.setItem(VERIFIED_USER_KEY, currentUserId);
    setFullyAuthenticated(true);
    clearPendingAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        permissions,
        loading,
        fullyAuthenticated,
        pendingStep,
        pendingUserId,
        pendingMfaFactorId,
        signOut,
        canAccess,
        refetchProfile,
        markFullyAuthenticated,
        startPendingAccessCode,
        startPendingMfa,
        clearPendingAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
