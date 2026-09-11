import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findNearbyUrgentLeads, isUrgentLead, type ProximityLead } from "@/lib/lead-proximity";
import { preloadZipDataset } from "@/lib/zipCentroids";

const QUERY_KEY = ["urgent-leads-proximity"];

/**
 * Other urgent leads near one lead, for the lead detail page.
 *
 * The card gets this from the list it already holds; a single-lead page has no list, so this
 * fetches the urgent set. RLS still scopes it - a CS only ever compares against their own
 * leads, exactly as on the card. A realtime subscription keeps it live, refetching only when a
 * change could matter: a lead becoming urgent, or one already in the set changing or leaving.
 */
export function useNearbyUrgentLeads(lead: ProximityLead | null): ProximityLead[] {
  const queryClient = useQueryClient();
  const active = Boolean(lead) && isUrgentLead(lead?.status);

  const { data: urgentLeads = [] } = useQuery<ProximityLead[]>({
    queryKey: QUERY_KEY,
    enabled: active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, customer_name, status, address, city, state, zip_code, job_id")
        .eq("status", "urgent_job");
      if (error) throw error;
      return (data ?? []) as ProximityLead[];
    },
    staleTime: 30_000,
  });

  // Ids currently held, so an urgent lead leaving Urgent is caught even when the realtime
  // payload's old row carries only the primary key.
  const heldIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    heldIds.current = new Set(urgentLeads.map((l) => l.id));
  }, [urgentLeads]);

  const [zipDataReady, setZipDataReady] = useState(false);
  useEffect(() => {
    if (!active || zipDataReady) return;
    let alive = true;
    void preloadZipDataset().then(() => {
      if (alive) setZipDataReady(true);
    });
    return () => {
      alive = false;
    };
  }, [active, zipDataReady]);

  useEffect(() => {
    if (!active) return;

    const channel = supabase
      .channel("lead-detail-urgent-proximity")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
        const next = payload.new as { id?: string; status?: string } | undefined;
        const prev = payload.old as { id?: string; status?: string } | undefined;
        const id = next?.id ?? prev?.id;
        const held = id ? heldIds.current.has(id) : false;

        if (held || next?.status === "urgent_job" || prev?.status === "urgent_job") {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, queryClient]);

  return useMemo(
    () => (lead && active ? findNearbyUrgentLeads(lead, urgentLeads) : []),
    // zipDataReady is not read here; recomputing once the centroids land is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lead, active, urgentLeads, zipDataReady],
  );
}
