import { supabase } from "@/integrations/supabase/client";

type LeadUpdatePayload = Record<string, unknown>;

const NO_ROW_UPDATED_MESSAGE = "Lead update was not applied. Check your permissions and refresh the page.";

export async function updateLeadById(leadId: string, changes: LeadUpdatePayload) {
  const { data, error } = await supabase
    .from("leads")
    .update(changes as never)
    .eq("id", leadId)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error(NO_ROW_UPDATED_MESSAGE);

  return data;
}
