import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

// DISABLED: no scheduled AI daily report. Quo AI only runs on new incoming messages.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  return jsonResponse({
    success: true,
    disabled: true,
    reason: "Daily brief disabled — AI only runs on new incoming messages.",
  });
});
