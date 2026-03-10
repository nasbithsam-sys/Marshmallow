import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details as any,
  });
}