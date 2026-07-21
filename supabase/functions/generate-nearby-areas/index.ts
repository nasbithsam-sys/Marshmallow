// supabase/functions/generate-nearby-areas/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Area = {
  name: string;
  state: string;
  distance_miles?: number | null;
  reason?: string | null;
};

const EARTH_RADIUS_MI = 3958.7613;
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(s)));
}

function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const role = roleRow?.role;
    if (role !== "admin" && role !== "processor") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const leadId = String(body.leadId ?? "");
    if (!leadId) return jsonResponse({ error: "leadId is required" }, 400);

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select(
        "id, address, half_address, city, state, zip_code, latitude, longitude"
      )
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr || !lead) return jsonResponse({ error: "Lead not found" }, 404);

    const city = (lead.city ?? "").trim();
    const state = (lead.state ?? "").trim();
    const zip = (lead.zip_code ?? "").trim();
    const address = (lead.address ?? lead.half_address ?? "").trim();
    const lat = typeof lead.latitude === "number" ? lead.latitude : null;
    const lng = typeof lead.longitude === "number" ? lead.longitude : null;

    // Require at least (city+state) OR zip OR full address OR coords
    const hasEnough =
      (city && state) || zip || address || (lat !== null && lng !== null);
    if (!hasEnough) {
      return jsonResponse(
        { error: "Add a customer city and state or complete address before generating nearby areas." },
        400,
      );
    }

    const center =
      city && state
        ? `${city}, ${state}`
        : address || (zip ? `ZIP ${zip}` : `${lat},${lng}`);
    const sourceAddress = [address, city, state, zip].filter(Boolean).join(", ");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI is not configured" }, 500);

    const prompt = `Identify the most populated cities, towns, suburbs, and commonly recognized service areas located within approximately 50 miles of the following customer location:

${center}

Customer address when available:
${sourceAddress || "n/a"}

Coordinates when available:
Latitude: ${lat ?? "n/a"}
Longitude: ${lng ?? "n/a"}

Requirements:
- Prefer populated cities, towns, suburbs, and recognized communities.
- Keep results within approximately 50 miles.
- Do not include the exact customer city as a nearby suggestion.
- Do not invent locations. Do not include areas clearly outside the radius.
- Return 8 to 15 results, sorted by estimated population or practical service importance.
- Include an approximate straight-line distance in miles from the customer location when possible.
- Include city and state for every result.

Return ONLY a JSON object of this shape (no prose, no markdown):
{
  "center_location": "City, State",
  "radius_miles": 50,
  "areas": [
    { "name": "Name", "state": "State", "distance_miles": 18, "reason": "short reason" }
  ]
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a US geography assistant. Return valid JSON only, matching the requested schema exactly.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: `AI request failed: ${msg}` }, 502);
    }
    clearTimeout(timeoutId);

    if (aiResp.status === 429)
      return jsonResponse({ error: "AI rate limit reached. Please try again shortly." }, 429);
    if (aiResp.status === 402)
      return jsonResponse({ error: "AI credits exhausted. Contact admin." }, 402);
    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      return jsonResponse({ error: `AI error (${aiResp.status})`, detail: errText.slice(0, 300) }, 502);
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: { areas?: unknown; center_location?: unknown; radius_miles?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return jsonResponse({ error: "AI returned invalid JSON" }, 502);
    }

    const rawAreas = Array.isArray(parsed?.areas) ? (parsed.areas as unknown[]) : [];
    const centerLower = normName(city);
    const seen = new Set<string>();
    const clean: Area[] = [];

    for (const it of rawAreas) {
      if (!it || typeof it !== "object") continue;
      const rec = it as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      const st = typeof rec.state === "string" ? rec.state.trim() : "";
      if (!name || !st) continue;
      const key = `${normName(name)}|${normName(st)}`;
      if (seen.has(key)) continue;
      if (normName(name) === centerLower) continue;
      let dist: number | null = null;
      if (typeof rec.distance_miles === "number" && Number.isFinite(rec.distance_miles)) {
        dist = rec.distance_miles;
      } else if (typeof rec.distance_miles === "string") {
        const n = parseFloat(rec.distance_miles);
        if (Number.isFinite(n)) dist = n;
      }
      // Enforce radius when we have a distance; allow small tolerance
      if (dist !== null && dist > 60) continue;
      if (dist !== null && dist < 0) continue;
      seen.add(key);
      clean.push({
        name,
        state: st,
        distance_miles: dist,
        reason: typeof rec.reason === "string" ? rec.reason.slice(0, 160) : null,
      });
      if (clean.length >= 15) break;
    }

    // If we have center coords, validate/adjust distances via haversine when the AI
    // provided lat/lng or a nearby lookup wasn't possible — otherwise trust AI value.
    // (No secondary geocoding pass to avoid a new provider dependency.)

    if (clean.length === 0) {
      return jsonResponse(
        { error: "No populated nearby areas were found within approximately 50 miles." },
        404,
      );
    }

    // Sort: by distance ascending when known, else keep AI order.
    clean.sort((a, b) => {
      const da = a.distance_miles ?? 9999;
      const db = b.distance_miles ?? 9999;
      return da - db;
    });

    const payload = {
      center_location:
        typeof parsed.center_location === "string" ? parsed.center_location : center,
      radius_miles: 50,
      generated_at: new Date().toISOString(),
      source_address: sourceAddress || center,
      areas: clean,
    };

    const { error: updErr } = await admin
      .from("leads")
      .update({ nearby_areas: payload })
      .eq("id", leadId);
    if (updErr) return jsonResponse({ error: `Failed to save: ${updErr.message}` }, 500);

    return jsonResponse({ nearby_areas: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});
