import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  status: string;
  is_visible: boolean;
};

export function useAllowedStatuses() {
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

      if (error || !Array.isArray(data)) {
        return baseAllowed;
      }

      const finalAllowed = new Set<string>(baseAllowed);

      for (const row of data as VisibilityRow[]) {
        if (!row?.status) continue;

        if (row.is_visible === false) {
          finalAllowed.delete(row.status);
        }

        if (row.is_visible === true && baseAllowed.has(row.status)) {
          finalAllowed.add(row.status);
        }
      }

      return finalAllowed;
    },
    enabled: !!role,
    staleTime: 30_000,
  });

  const statuses = allowedStatuses ?? getBaseAllowedStatuses(role);

  const filterLeads = <T extends { status: string }>(leads: T[]): T[] => {
    return leads.filter((lead) => statuses.has(lead.status));
  };

  return {
    allowedStatuses: statuses,
    filterLeads,
  };
}
