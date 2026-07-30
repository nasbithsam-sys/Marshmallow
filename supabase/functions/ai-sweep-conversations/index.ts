import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

// DISABLED: Quo AI must only run on newly received messages.
// This sweep used to re-analyze old/stale conversations; it is now a no-op.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  return jsonResponse({
    success: true,
    disabled: true,
    reason: "Sweep disabled — AI only runs on new incoming messages.",
    scanned: 0,
    marked_possible_dead: 0,
    queued_analysis: 0,
  });
});
