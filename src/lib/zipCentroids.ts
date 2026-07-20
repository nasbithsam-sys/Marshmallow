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
 * - Accepts ZIP+4 (returns just the 5-digit prefix)
 * - Does NOT require whitespace between the state abbrev and ZIP (e.g. "CA94551")
 * - Preserves leading zeroes (values are treated as strings)
 * - Ignores 5-digit runs that are part of a longer number
 */
export function extractZip(value?: string | null): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Match exactly 5 digits, optionally followed by -NNNN, not adjacent to more digits.
  const re = /(?<!\d)(\d{5})(?:-\d{4})?(?!\d)/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) matches.push(m[1]);
  if (matches.length === 0) return null;
  // Prefer the last match (typical trailing position in an address).
  const five = matches[matches.length - 1];
  return /^\d{5}$/.test(five) ? five : null;
}

/**
 * Resolve the best usable 5-digit ZIP for a lead.
 * Priority: explicit zip_code field → ZIP parsed from full address.
 * Returns both the chosen ZIP and where it came from (for diagnostics).
 */
export function resolveZipDetailed(input: {
  zip_code?: string | null;
  address?: string | null;
}): { zip: string | null; source: "zip_field" | "address" | "none"; storedZip: string | null; addressZip: string | null } {
  const storedZip = extractZip(input.zip_code);
  const addressZip = extractZip(input.address);
  if (storedZip) return { zip: storedZip, source: "zip_field", storedZip, addressZip };
  if (addressZip) return { zip: addressZip, source: "address", storedZip, addressZip };
  return { zip: null, source: "none", storedZip, addressZip };
}

export function resolveZip(input: {
  zip_code?: string | null;
  address?: string | null;
}): string | null {
  return resolveZipDetailed(input).zip;
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
