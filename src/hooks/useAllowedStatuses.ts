import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultVisibleStatuses } from "@/lib/access";
import type { LeadStatus } from "@/types";

type VisibilityRow = {
  role?: string | null;
  user_id?: string | null;
  status: string;
  is_visible: boolean;
};

export function useAllowedStatuses() {
  const { role, user } = useAuth();

  const { data: allowedStatuses } = useQuery({
    queryKey: ["lead-status-visibility", user?.id, role],
    queryFn: async () => {
      const baseAllowed = getDefaultVisibleStatuses(role);

      if (!role) return baseAllowed;
      if (role === "admin") return baseAllowed;
      if (!user?.id) return baseAllowed;

      const { data, error } = await supabase
        .from("lead_status_visibility")
        .select("user_id,role,status,is_visible")
        .or(`user_id.eq.${user.id},and(user_id.is.null,role.eq.${role})`);

      if (error || !Array.isArray(data)) {
        return baseAllowed;
      }

      const finalAllowed = new Set<string>(baseAllowed);
      const rows = data as VisibilityRow[];
      const roleRows = rows.filter((row) => !row.user_id && row.role === role);
      const userSpecificRows = rows.filter((row) => row.user_id === user.id);

      for (const row of [...roleRows, ...userSpecificRows]) {
        if (!row?.status) {
          continue;
        }

        if (row.is_visible === false) {
          finalAllowed.delete(row.status);
        }

        if (row.is_visible === true) {
          finalAllowed.add(row.status);
        }
      }

      return finalAllowed;
    },
    enabled: !!role && !!user?.id,
    staleTime: 30_000,
  });

  const statuses = allowedStatuses ?? getDefaultVisibleStatuses(role);

  const filterLeads = <T extends { status: string }>(leads: T[]): T[] => {
    return leads.filter((lead) => statuses.has(lead.status));
  };

  return {
    allowedStatuses: statuses,
    filterLeads,
  };
}
