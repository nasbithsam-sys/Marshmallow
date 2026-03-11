import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  userId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    user_name: "",
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ? JSON.stringify(details) : null,
  });
}