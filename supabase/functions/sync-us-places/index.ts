// Admin-only: syncs Census Places (Gazetteer 2024) + ACS 5-year population (2023)
// into public.us_places. Idempotent upsert by GEOID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

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

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico",
};

const STATE_FIPS_TO_CODE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "72": "PR",
};

const GAZETTEER_YEAR = 2024;
const ACS_YEAR = 2023;
const GAZETTEER_URL = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${GAZETTEER_YEAR}_Gazetteer/${GAZETTEER_YEAR}_Gaz_place_national.zip`;
const ACS_URL = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=B01003_001E&for=place:*&in=state:*`;

interface PlaceRow {
  geoid: string;
  name: string;
  state_code: string;
  state_name: string;
  latitude: number;
  longitude: number;
}

async function fetchGazetteer(): Promise<PlaceRow[]> {
  const resp = await fetch(GAZETTEER_URL);
  if (!resp.ok) throw new Error(`Gazetteer fetch failed: ${resp.status}`);
  const zipBuf = new Uint8Array(await resp.arrayBuffer());
  const unzipped = unzipSync(zipBuf);
  const entry = Object.keys(unzipped).find((k) => k.toLowerCase().endsWith(".txt"));
  if (!entry) throw new Error("Gazetteer zip missing .txt file");
  const text = strFromU8(unzipped[entry]);
  const lines = text.split(/\r?\n/);
  const header = lines.shift() ?? "";
  const cols = header.split("\t").map((c) => c.trim());
  const idx = (n: string) => cols.indexOf(n);
  const iState = idx("USPS");
  const iGeoid = idx("GEOID");
  const iName = idx("NAME");
  const iLat = idx("INTPTLAT");
  const iLng = idx("INTPTLONG");
  if (iState < 0 || iGeoid < 0 || iName < 0 || iLat < 0 || iLng < 0) {
    throw new Error(`Gazetteer header unexpected: ${cols.join(",")}`);
  }
  const rows: PlaceRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split("\t").map((p) => p.trim());
    const state = parts[iState];
    const geoid = parts[iGeoid];
    const name = parts[iName];
    const lat = parseFloat(parts[iLat]);
    const lng = parseFloat(parts[iLng]);
    if (!geoid || !name || !state) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    rows.push({
      geoid,
      name,
      state_code: state,
      state_name: STATE_NAMES[state] ?? state,
      latitude: lat,
      longitude: lng,
    });
  }
  return rows;
}

async function fetchAcsPopulations(): Promise<Map<string, number>> {
  const resp = await fetch(ACS_URL);
  if (!resp.ok) throw new Error(`ACS fetch failed: ${resp.status}`);
  const data = (await resp.json()) as string[][];
  const header = data.shift();
  if (!header) throw new Error("ACS empty");
  const iPop = header.indexOf("B01003_001E");
  const iState = header.indexOf("state");
  const iPlace = header.indexOf("place");
  if (iPop < 0 || iState < 0 || iPlace < 0) throw new Error("ACS header unexpected");
  const map = new Map<string, number>();
  for (const row of data) {
    const pop = parseInt(row[iPop], 10);
    if (!Number.isFinite(pop) || pop <= 0) continue;
    const geoid = row[iState] + row[iPlace];
    map.set(geoid, pop);
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const cronSecret = Deno.env.get("FUNCTION_CRON_SECRET") ?? "";
    const providedCron = req.headers.get("x-cron-secret") ?? "";
    const isCron = cronSecret.length > 0 && providedCron === cronSecret;

    if (!isCron) {
      const auth = req.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const token = auth.slice(7);
      // Allow service-role key as caller bypass.
      if (token !== SERVICE_KEY) {
        const { data: userRes, error: userErr } = await admin.auth.getUser(token);
        if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userRes.user.id)
          .maybeSingle();
        if (roleRow?.role !== "admin") return json({ error: "Forbidden" }, 403);
      }
    }


    const [places, populations] = await Promise.all([fetchGazetteer(), fetchAcsPopulations()]);

    const now = new Date().toISOString();
    let imported = 0;
    let skipped = 0;
    const batch: Record<string, unknown>[] = [];
    for (const p of places) {
      const pop = populations.get(p.geoid) ?? 0;
      if (pop <= 0) { skipped++; continue; }
      batch.push({
        geoid: p.geoid,
        name: p.name,
        state_code: p.state_code,
        state_name: p.state_name,
        population: pop,
        latitude: p.latitude,
        longitude: p.longitude,
        population_vintage: ACS_YEAR,
        geography_vintage: GAZETTEER_YEAR,
        updated_at: now,
      });
    }

    const CHUNK = 1000;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const chunk = batch.slice(i, i + CHUNK);
      const { error } = await admin.from("us_places").upsert(chunk, { onConflict: "geoid" });
      if (error) return json({ error: `Upsert failed: ${error.message}`, imported, skipped }, 500);
      imported += chunk.length;
    }

    return json({
      ok: true,
      places_in_gazetteer: places.length,
      places_with_population: batch.length,
      imported,
      skipped,
      population_vintage: ACS_YEAR,
      geography_vintage: GAZETTEER_YEAR,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
