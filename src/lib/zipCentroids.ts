// Local US ZIP code centroid dataset lookup.
// Dataset is loaded lazily (dynamic import) so the ~1.8MB JSON stays out of
// the initial JS bundle and is only fetched when Map View mounts.

export interface ZipCentroid {
  zip: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

type ZipRow = [number, number, string, string]; // [lat, lng, city, state]
type ZipDataset = Record<string, ZipRow>;

let datasetPromise: Promise<ZipDataset> | null = null;

async function getDataset(): Promise<ZipDataset> {
  if (!datasetPromise) {
    datasetPromise = import("@/data/usZipCentroids.json").then(
      (m) => ((m as { default?: unknown }).default ?? m) as unknown as ZipDataset,
    );
  }
  return datasetPromise;
}

/**
 * Extract a valid 5-digit US ZIP code from arbitrary text.
 * Accepts ZIP+4 and returns just the 5-digit prefix.
 */
export function extractZip(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Prefer a ZIP that appears near the end (typical address format).
  const matches = raw.match(/\b\d{5}(?:-\d{4})?\b/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const five = last.slice(0, 5);
  return /^\d{5}$/.test(five) ? five : null;
}

/**
 * Resolve the best usable 5-digit ZIP for a lead.
 * Priority: explicit zip_code field → ZIP parsed from full address.
 */
export function resolveZip(input: {
  zip_code?: string | null;
  address?: string | null;
}): string | null {
  const direct = extractZip(input.zip_code);
  if (direct) return direct;
  return extractZip(input.address);
}

/** Preload the dataset (e.g. call on mount to warm the cache). */
export async function preloadZipDataset(): Promise<void> {
  await getDataset();
}

/** Synchronous accessor once dataset is loaded. Returns null if not yet loaded. */
let cachedSync: ZipDataset | null = null;
getDataset().then((d) => { cachedSync = d; }).catch(() => {});

export function lookupZipCentroidSync(zip: string | null | undefined): ZipCentroid | null {
  if (!zip || !cachedSync) return null;
  const row = cachedSync[zip];
  if (!row) return null;
  return { zip, latitude: row[0], longitude: row[1], city: row[2], state: row[3] };
}

export async function lookupZipCentroid(zip: string | null | undefined): Promise<ZipCentroid | null> {
  if (!zip) return null;
  const ds = await getDataset();
  const row = ds[zip];
  if (!row) return null;
  return { zip, latitude: row[0], longitude: row[1], city: row[2], state: row[3] };
}
