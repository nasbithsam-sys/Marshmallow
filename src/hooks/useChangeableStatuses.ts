import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getChangeableStatuses as roleDefaults } from "@/lib/constants";
import type { LeadStatus } from "@/types";

/**
 * Returns the set of statuses the current user is allowed to change leads INTO.
 *
 * Resolution order:
 *  - Admins: all role defaults (full access).
 *  - If the user has a row in `user_status_change_permissions`, that explicit
 *    list is used (even if empty — meaning admin revoked all access).
 *  - Otherwise: fall back to role defaults from `STATUS_CHANGE_ACCESS`.
 */
export function useChangeableStatuses() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  // Re-fetch whenever the admin changes this user's permissions row in real time
  useEffect(() => {
    if (!user?.id || role === "admin") return;

    const channel = supabase
      .channel(`status-change-perms-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_status_change_permissions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-status-change-permissions", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, role, queryClient]);

  const { data } = useQuery({
    // NOTE: key must include user.id so cache is per-user, AND must match
    // the key invalidated in Settings.tsx toggleStatusChangeAccess.onSuccess
    queryKey: ["user-status-change-permissions", user?.id],
    enabled: !!user?.id && role !== "admin",
    staleTime: 0, // always re-fetch so admin changes take effect immediately
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_status_change_permissions")
        .select("allowed_statuses")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) return null;
      // data is null when no row exists → fall back to role defaults
      // data.allowed_statuses is [] when admin explicitly cleared all access
      if (!data) return null;
      return (data.allowed_statuses ?? []) as LeadStatus[];
    },
  });

  const statuses: LeadStatus[] =
    role === "admin" || !user?.id
      ? roleDefaults(role)
      : data !== null && data !== undefined
        ? data
        : roleDefaults(role);

  const canChange = (status: LeadStatus) => statuses.includes(status);

  return { changeableStatuses: statuses, canChange };
}
