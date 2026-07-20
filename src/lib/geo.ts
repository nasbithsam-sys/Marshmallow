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
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Geocode a free-form address/city/ZIP through OpenStreetMap Nominatim.
 *  Cached in localStorage. Failures cached for 24h to avoid repeated hits. */
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("geocode failed");
    const data: Array<{ lat: string; lon: string }> = await res.json();
    if (!data.length) {
      cache[key] = { failed: true, ts: Date.now() };
      writeCache(cache);
      return null;
    }
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    cache[key] = { lat, lng };
    writeCache(cache);
    return { latitude: lat, longitude: lng };
  } catch {
    cache[key] = { failed: true, ts: Date.now() };
    writeCache(cache);
    return null;
  }
}

/** Geocode many addresses sequentially with a short delay to respect Nominatim rate limits. */
export async function geocodeBatch(
  addresses: string[],
  onEach?: (address: string, coords: LatLng | null) => void,
): Promise<Map<string, LatLng>> {
  const out = new Map<string, LatLng>();
  for (const address of addresses) {
    const coords = await geocodeAddress(address);
    if (coords) out.set(address, coords);
    onEach?.(address, coords);
    // gentle pacing for Nominatim's ~1 req/sec policy
    await new Promise((r) => setTimeout(r, 1100));
  }
  return out;
}
