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
];

const PROCESSOR_ONLY_STATUSES: LeadStatus[] = ["scheduled", "job_in_progress", "paid", "payment_pending", "job_done"];

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

export function useAllowedStatuses() {
  const { user, role } = useAuth();

  const { data: allowedStatuses } = useQuery({
    queryKey: ["status-permissions", user?.id, role],
    queryFn: async () => {
      const baseAllowed = getBaseAllowedStatuses(role);

      if (!user) return baseAllowed;
      if (role === "admin") return baseAllowed;

      const { data, error } = await supabase
        .from("status_permissions")
        .select("status, allowed")
        .eq("user_id", user.id);

      if (error || !data) {
        return baseAllowed;
      }

      const explicitPerms = new Map<string, boolean>();
      data.forEach((p: any) => {
        explicitPerms.set(p.status, p.allowed);
      });

      // Start with base role statuses (these are always kept)
      const finalAllowed = new Set<string>(baseAllowed);

      // Only ADD extra statuses that are explicitly allowed beyond the base set
      for (const [status, allowed] of explicitPerms) {
        if (allowed && !baseAllowed.has(status)) {
          finalAllowed.add(status);
        }
      }

      return finalAllowed;
    },
    enabled: !!role,
    staleTime: 30_000,
  });

  const statuses = allowedStatuses ?? getBaseAllowedStatuses(role);

  const filterLeads = <T extends { status: string }>(leads: T[]): T[] => leads.filter((l) => statuses.has(l.status));

  return { allowedStatuses: statuses, filterLeads };
}
