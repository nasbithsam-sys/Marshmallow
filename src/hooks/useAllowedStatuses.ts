import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
<<<<<<< HEAD
import { getDefaultVisibleStatuses } from "@/lib/access";
import type { LeadStatus } from "@/types";

type VisibilityRow = {
  role?: string | null;
  user_id?: string | null;
=======
import { ALL_LEAD_STATUSES } from "@/lib/constants";
import type { LeadStatus } from "@/types";

const CS_ONLY_STATUSES: LeadStatus[] = [
  "need_tech",
  "urgent_job",
  "waiting_customer_response",
  "waiting_complete_details",
  "quote_sent_waiting",
  "quote_sent_need_follow_up",
  "needs_quote",
  "cancelled",
];

const PROCESSOR_ONLY_STATUSES: LeadStatus[] = [
  "scheduled",
  "job_in_progress",
  "paid",
  "payment_pending",
  "job_done",
  "cancelled",
];

const SHARED_STATUSES: LeadStatus[] = ["needs_reschedule"];

function getBaseAllowedStatuses(role?: string | null): Set<string> {
  if (role === "admin") {
    return new Set<string>(ALL_LEAD_STATUSES);
  }

  if (role === "customer_service") {
    return new Set<string>([...CS_ONLY_STATUSES, ...SHARED_STATUSES]);
  }

  if (role === "processor") {
    return new Set<string>([...PROCESSOR_ONLY_STATUSES, ...SHARED_STATUSES]);
  }

  return new Set<string>();
}

type VisibilityRow = {
  role: string;
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  status: string;
  is_visible: boolean;
};

export function useAllowedStatuses() {
<<<<<<< HEAD
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
=======
  const { role } = useAuth();

  const { data: allowedStatuses } = useQuery({
    queryKey: ["lead-status-visibility", role],
    queryFn: async () => {
      const baseAllowed = getBaseAllowedStatuses(role);

      if (!role) return baseAllowed;
      if (role === "admin") return baseAllowed;

      const { data, error } = await (supabase as any)
        .from("lead_status_visibility")
        .select("role,status,is_visible")
        .eq("role", role);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

      if (error || !Array.isArray(data)) {
        return baseAllowed;
      }

      const finalAllowed = new Set<string>(baseAllowed);
<<<<<<< HEAD
      const userSpecificRows = (data as VisibilityRow[]).filter((row) => row.user_id === user.id);
      const fallbackRows = userSpecificRows.length > 0 ? userSpecificRows : (data as VisibilityRow[]);

      for (const row of fallbackRows) {
=======

      for (const row of data as VisibilityRow[]) {
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
        if (!row?.status) continue;

        if (row.is_visible === false) {
          finalAllowed.delete(row.status);
        }

<<<<<<< HEAD
        if (row.is_visible === true) {
=======
        if (row.is_visible === true && baseAllowed.has(row.status)) {
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
          finalAllowed.add(row.status);
        }
      }

      return finalAllowed;
    },
<<<<<<< HEAD
    enabled: !!role && !!user?.id,
    staleTime: 30_000,
  });

  const statuses = allowedStatuses ?? getDefaultVisibleStatuses(role);
=======
    enabled: !!role,
    staleTime: 30_000,
  });

  const statuses = allowedStatuses ?? getBaseAllowedStatuses(role);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

  const filterLeads = <T extends { status: string }>(leads: T[]): T[] => {
    return leads.filter((lead) => statuses.has(lead.status));
  };

  return {
    allowedStatuses: statuses,
    filterLeads,
  };
}
