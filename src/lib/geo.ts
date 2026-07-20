// Geographic helpers for Map View.

export const MILES_PER_KM = 0.621371;
export const EARTH_RADIUS_MI = 3958.7613;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in miles between two coordinates (haversine). */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const la = typeof lat === "number" ? lat : Number(lat);
  const ln = typeof lng === "number" ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

const GEOCODE_CACHE_KEY = "marshmallow_geocode_cache_v1";

type CacheShape = Record<string, { lat: number; lng: number } | { failed: true; ts: number }>;

function readCache(): CacheShape {
  try {
    const raw = window.localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape) {
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

export function normalizeAddress(input: string): string {
  return input
    .replace(/\bnull\b/gi, "")
    .replace(/\bundefined\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanPart(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s;
}

/** Build a prioritized list of geocoding queries from lead-like location fields. */
export function buildGeocodeQueries(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string[] {
  const address = cleanPart(input.address);
  const city = cleanPart(input.city);
  const state = cleanPart(input.state);
  const zip = cleanPart(input.zip);

  const join = (...parts: string[]) =>
    parts.filter(Boolean).join(", ").replace(/,\s*,/g, ", ").trim();

  const candidates: string[] = [];
  if (address && city && state && zip) candidates.push(join(address, city, state, zip, "USA"));
  if (address && city && state) candidates.push(join(address, city, state, "USA"));
  if (address && zip) candidates.push(join(address, zip, "USA"));
  if (city && state && zip) candidates.push(join(city, state, zip, "USA"));
  if (city && state) candidates.push(join(city, state, "USA"));
  if (zip) candidates.push(join(zip, "USA"));
  if (address && !city && !state && !zip) candidates.push(join(address, "USA"));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const key = normalizeAddress(c);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function nominatimQuery(query: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`geocode http ${res.status}`);
  const data: Array<{ lat: string; lon: string }> = await res.json();
  if (!data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!isValidLatLng(lat, lng)) return null;
  return { latitude: lat, longitude: lng };
}

/** Geocode a single free-form address; cached in localStorage. */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = normalizeAddress(address);
  if (!key) return null;
  const cache = readCache();
  const entry = cache[key];
  if (entry) {
    if ("failed" in entry) {
      if (Date.now() - entry.ts < 24 * 3600 * 1000) return null;
    } else {
      return { latitude: entry.lat, longitude: entry.lng };
    }
  }

  try {
    const result = await nominatimQuery(address);
    if (!result) {
      cache[key] = { failed: true, ts: Date.now() };
      writeCache(cache);
      return null;
    }
    cache[key] = { lat: result.latitude, lng: result.longitude };
    writeCache(cache);
    return result;
  } catch {
    // transient error — don't poison cache
    return null;
  }
}

export type GeocodeFailReason = "no_result" | "request_failed" | "no_input";

export interface GeocodeAttemptResult {
  coords: LatLng | null;
  query: string | null;
  reason: GeocodeFailReason | null;
}

/** Geocode with progressive fallback from the most specific query to the least. */
export async function geocodeWithFallback(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<GeocodeAttemptResult> {
  const queries = buildGeocodeQueries(input);
  if (!queries.length) return { coords: null, query: null, reason: "no_input" };

  let lastReason: GeocodeFailReason = "no_result";
  for (const q of queries) {
    const key = normalizeAddress(q);
    const cache = readCache();
    const hit = cache[key];
    if (hit && !("failed" in hit)) {
      return { coords: { latitude: hit.lat, longitude: hit.lng }, query: q, reason: null };
    }
    if (hit && "failed" in hit && Date.now() - hit.ts < 24 * 3600 * 1000) {
      continue;
    }
    try {
      const res = await nominatimQuery(q);
      if (res) {
        const fresh = readCache();
        fresh[key] = { lat: res.latitude, lng: res.longitude };
        writeCache(fresh);
        return { coords: res, query: q, reason: null };
      }
      const fresh = readCache();
      fresh[key] = { failed: true, ts: Date.now() };
      writeCache(fresh);
      lastReason = "no_result";
    } catch {
      lastReason = "request_failed";
    }
    // pacing between attempts to respect Nominatim's ~1 req/sec policy
    await new Promise((r) => setTimeout(r, 1100));
  }
  return { coords: null, query: null, reason: lastReason };
}
