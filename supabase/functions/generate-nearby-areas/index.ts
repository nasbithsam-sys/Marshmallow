// Non-AI: geocode customer address, then look up top-5 populated places within
// 50 miles via public.get_top_nearby_populated_areas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const STATE_CODES = new Set(Object.values(STATE_ABBR));

const STREET_SUFFIX_RE =
  /\b(?:aly|alley|ave|avenue|blvd|boulevard|cir|circle|ct|court|dr|drive|hwy|highway|ln|lane|loop|pkwy|parkway|pl|place|rd|road|st|street|ter|terrace|trl|trail|way)\.?\b/i;

function normalizeStateToken(s: string): string {
  const lower = s.trim().toLowerCase();
  return STATE_ABBR[lower] ?? s.trim().toUpperCase();
}

function normalizeZipToken(s: string): string {
  const match = s.match(/\b(?:[A-Z]{2}\s*)?(\d{5})(?:-\d{4})?\b/i);
  return match?.[1] ?? "";
}

function normalizeAddress(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/,+/g, ",").replace(/\s*,\s*/g, ", ");
  // Expand full state names to abbreviations at word boundaries
  for (const [full, abbr] of Object.entries(STATE_ABBR)) {
    const re = new RegExp(`\\b${full}\\b`, "gi");
    s = s.replace(re, abbr);
  }
  return s.replace(/^[,\s]+|[,\s]+$/g, "");
}

function extractZipAndState(raw: string): { zip: string; state: string; matchText: string } {
  const match = raw.match(/\b([A-Z]{2})?\s*(\d{5})(?:-\d{4})?\b/i);
  const possibleState = match?.[1]?.toUpperCase() ?? "";
  return {
    zip: match?.[2] ?? "",
    state: STATE_CODES.has(possibleState) ? possibleState : "",
    matchText: match?.[0] ?? "",
  };
}

function inferInlineAddressParts(raw: string): { street: string; city: string; state: string; zip: string } {
  const normalized = normalizeAddress(raw);
  const zipInfo = extractZipAndState(normalized);
  let state = zipInfo.state;
  let withoutZip = normalized;

  if (zipInfo.matchText) {
    withoutZip = withoutZip.replace(zipInfo.matchText, " ");
  }

  if (!state) {
    const stateAtEnd = withoutZip.match(/(?:^|[\s,])([A-Z]{2})(?:[\s,]*$)/i);
    const possibleState = stateAtEnd?.[1]?.toUpperCase() ?? "";
    if (STATE_CODES.has(possibleState)) state = possibleState;
  }

  if (state) {
    withoutZip = withoutZip.replace(new RegExp(`(?:^|[\\s,])${state}(?:[\\s,]*$)`, "i"), " ");
  }

  const locationText = withoutZip.replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
  if (!locationText) return { street: "", city: "", state, zip: zipInfo.zip };

  const commaParts = locationText.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const city = commaParts[commaParts.length - 1];
    const street = commaParts.slice(0, -1).join(", ");
    return { street, city, state, zip: zipInfo.zip };
  }

  const suffixMatch = STREET_SUFFIX_RE.exec(locationText);
  if (suffixMatch?.index !== undefined) {
    const suffixEnd = suffixMatch.index + suffixMatch[0].length;
    const street = locationText.slice(0, suffixEnd).trim();
    const city = locationText.slice(suffixEnd).trim();
    return { street, city, state, zip: zipInfo.zip };
  }

  return { street: "", city: locationText, state, zip: zipInfo.zip };
}

/** Try to strip a leading business/place name and return {placeName, streetAddress}. */
function separateBusinessName(raw: string): { placeName: string | null; addr: string } {
  const m = raw.match(/^(.*?)\s(\d+\s+[A-Za-z0-9].*)$/);
  if (m) {
    const before = m[1].trim();
    const rest = m[2].trim();
    if (before && !/^\d/.test(before) && before.split(/\s+/).length >= 2) {
      return { placeName: before, addr: rest };
    }
  }
  return { placeName: null, addr: raw };
}

async function nominatimFree(q: string, signal: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&addressdetails=0&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    signal,
    headers: { "User-Agent": "MarshmallowCRM/1.0 (nearby-areas)" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  if (!data?.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matched: data[0].display_name ?? q };
}

async function nominatimStructured(
  parts: { street?: string; city?: string; state?: string; postalcode?: string },
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("limit", "1");
  params.set("countrycodes", "us");
  if (parts.street) params.set("street", parts.street);
  if (parts.city) params.set("city", parts.city);
  if (parts.state) params.set("state", parts.state);
  if (parts.postalcode) params.set("postalcode", parts.postalcode);
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const r = await fetch(url, {
    signal,
    headers: { "User-Agent": "MarshmallowCRM/1.0 (nearby-areas)" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  if (!data?.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matched: data[0].display_name ?? "" };
}

async function zipCentroid(zip: string, signal: AbortSignal) {
  const cleanZip = normalizeZipToken(zip);
  if (!cleanZip) return null;
  const url = `https://api.zippopotam.us/us/${encodeURIComponent(cleanZip)}`;
  const r = await fetch(url, {
    signal,
    headers: { "User-Agent": "MarshmallowCRM/1.0 (nearby-areas)" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { places?: Array<{ latitude: string; longitude: string; "place name"?: string; state?: string; "state abbreviation"?: string }> };
  const place = data.places?.[0];
  if (!place) return null;
  const lat = parseFloat(place.latitude);
  const lng = parseFloat(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const matched = [place["place name"], place["state abbreviation"] || place.state, cleanZip]
    .filter(Boolean)
    .join(", ");
  return { lat, lng, matched };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const { data: userRes, error: userErr } = await admin.auth.getUser(auth.slice(7));
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const role = roleRow?.role;
    if (role !== "admin" && role !== "processor") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const leadId = String(body.leadId ?? "");
    if (!leadId) return json({ error: "leadId is required" }, 400);

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, address, half_address, city, state, zip_code, latitude, longitude")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr || !lead) return json({ error: "Lead not found" }, 404);

    const addressRaw = (lead.address ?? lead.half_address ?? "").trim();
    const { placeName, addr } = separateBusinessName(addressRaw);
    const inferred = inferInlineAddressParts(addr);
    const city =
      normalizeAddress((lead.city ?? "").trim()).replace(/,$/, "").trim() || inferred.city;
    const stateRaw = (lead.state ?? "").trim();
    const state = stateRaw ? normalizeStateToken(stateRaw) : inferred.state;
    const zip = normalizeZipToken((lead.zip_code ?? "").trim()) || inferred.zip;
    let lat: number | null =
      typeof lead.latitude === "number" && Number.isFinite(lead.latitude) ? lead.latitude : null;
    let lng: number | null =
      typeof lead.longitude === "number" && Number.isFinite(lead.longitude) ? lead.longitude : null;
    if (lat !== null && (lat < -90 || lat > 90 || (lat === 0 && lng === 0))) lat = null;
    if (lng !== null && (lng < -180 || lng > 180)) lng = null;

    const normalizedAddress = normalizeAddress(addr);
    const streetAddress = inferred.street ? normalizeAddress(inferred.street) : normalizedAddress;
    const addressHasInlineLocation = Boolean(inferred.zip || inferred.state || inferred.city);
    const parts = addressHasInlineLocation
      ? normalizedAddress
      : [normalizedAddress, city, state, zip].filter(Boolean).join(", ");
    const sourceAddress = parts || (lat !== null && lng !== null ? `${lat},${lng}` : "");

    const hasCoords = lat !== null && lng !== null;
    const hasEnough = hasCoords || (city && state) || zip || normalizedAddress;
    if (!hasEnough) {
      return json(
        {
          error:
            "Add a valid customer address, city and state, ZIP code, or coordinates before finding nearby areas.",
        },
        400,
      );
    }

    let matched = "";
    let accuracy: "coordinates" | "address" | "street_zip" | "city_state" | "zip_centroid" | "unknown" =
      "unknown";

    if (!hasCoords) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      try {
        // 1) full address free-form (works when address already contains city/state/zip inline)
        if (normalizedAddress) {
          const q = addressHasInlineLocation
            ? normalizedAddress
            : [normalizedAddress, city, state, zip].filter(Boolean).join(", ");
          const r = await nominatimFree(q, controller.signal);
          if (r) { lat = r.lat; lng = r.lng; matched = r.matched; accuracy = "address"; }
        }
        // 2) city + state + zip, inferred from single-line addresses like "121 Main St Dallas TX 75201"
        if (lat === null && (city || zip) && state) {
          const r = await nominatimStructured(
            { city, state, postalcode: zip || undefined },
            controller.signal,
          );
          if (r) { lat = r.lat; lng = r.lng; matched = r.matched; accuracy = "city_state"; }
        }
        // 3) ZIP centroid using a dedicated ZIP lookup first, then Nominatim as a secondary fallback
        if (lat === null && zip) {
          const r = await zipCentroid(zip, controller.signal);
          if (r) { lat = r.lat; lng = r.lng; matched = r.matched; accuracy = "zip_centroid"; }
        }
        if (lat === null && zip) {
          const r = await nominatimFree(`${zip}, USA`, controller.signal);
          if (r) { lat = r.lat; lng = r.lng; matched = r.matched; accuracy = "zip_centroid"; }
        }
        // 4) street + zip is last because some geocoders over-match street names across ZIP codes.
        if (lat === null && streetAddress && zip) {
          const r = await nominatimStructured(
            { street: streetAddress, postalcode: zip },
            controller.signal,
          );
          if (r) { lat = r.lat; lng = r.lng; matched = r.matched; accuracy = "street_zip"; }
        }
      } catch {
        // ignore, fall through
      } finally {
        clearTimeout(t);
      }
    } else {
      accuracy = "coordinates";
      matched = sourceAddress;
    }

    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json(
        { error: "Customer location could not be identified. Check the address and try again." },
        422,
      );
    }

    // Persist coords back to lead so we don't re-geocode next time
    if (!hasCoords) {
      await admin.from("leads").update({ latitude: lat, longitude: lng }).eq("id", leadId);
    }

    const { data: rows, error: rpcErr } = await admin.rpc("get_top_nearby_populated_areas", {
      _latitude: lat,
      _longitude: lng,
    });
    if (rpcErr) {
      // Distinguish "dataset empty" from other DB errors
      const { count } = await admin
        .from("us_places")
        .select("*", { count: "exact", head: true });
      if (!count || count === 0) {
        return json({ error: "Nearby population data is currently unavailable." }, 503);
      }
      return json({ error: "Unable to calculate nearby areas. Please try again." }, 500);
    }

    const { count: totalPlaces } = await admin
      .from("us_places")
      .select("*", { count: "exact", head: true });
    if (!totalPlaces || totalPlaces === 0) {
      return json({ error: "Nearby population data is currently unavailable." }, 503);
    }

    const areas = (rows ?? []).slice(0, 5).map((r) => ({
      geoid: r.geoid,
      name: r.name,
      state_code: r.state_code,
      state_name: r.state_name,
      population: r.population,
      distance_miles: r.distance_miles,
    }));

    if (areas.length === 0) {
      return json({ error: "No populated places were found within 50 miles." }, 404);
    }

    const payload = {
      center_location: {
        source_address: sourceAddress || (placeName ?? ""),
        matched_address: matched || sourceAddress,
        latitude: lat,
        longitude: lng,
        geocoding_accuracy: accuracy,
        place_name: placeName ?? null,
      },
      radius_miles: 50,
      method: "geocoder_and_census_population_dataset",
      population_vintage: 2023,
      generated_at: new Date().toISOString(),
      areas,
    };

    const { error: updErr } = await admin
      .from("leads")
      .update({ nearby_areas: payload })
      .eq("id", leadId);
    if (updErr) return json({ error: `Failed to save: ${updErr.message}` }, 500);

    return json({ nearby_areas: payload });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
