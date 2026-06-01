import { useQuery } from "@tanstack/react-query";
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
 *    list replaces the role defaults entirely.
 *  - Otherwise: fall back to role defaults from `STATUS_CHANGE_ACCESS`.
 */
export function useChangeableStatuses() {
  const { role, user } = useAuth();

  const { data } = useQuery({
    queryKey: ["user-status-change-permissions", user?.id],
    enabled: !!user?.id && role !== "admin",
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_status_change_permissions")
        .select("allowed_statuses")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error || !data) return null;
      return (data.allowed_statuses ?? []) as LeadStatus[];
    },
  });

  const statuses: LeadStatus[] =
    role === "admin" || !user?.id ? roleDefaults(role) : data ?? roleDefaults(role);

  const canChange = (status: LeadStatus) => statuses.includes(status);

  return { changeableStatuses: statuses, canChange };
}
