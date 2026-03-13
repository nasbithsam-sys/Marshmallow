import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  userId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>,
  userName?: string
) {
  // If userName not provided, look it up
  let resolvedName = userName || "";
  if (!resolvedName) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();
    resolvedName = profile?.full_name || "Unknown";
  }

  await supabase.from("activity_logs").insert({
    user_id: userId,
    user_name: resolvedName,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ? JSON.stringify(details) : null,
  });
}
