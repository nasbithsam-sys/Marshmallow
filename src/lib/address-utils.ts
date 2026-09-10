/**
 * Extract city/area from a US-style address string.
 *
 * Addresses arrive in whatever shape the intake produced, most often Google's
 * "815 Allerton St Redwood City, California 94063, USA" - note the missing comma between the
 * street and the city, and the country on the end.
 */

const COUNTRY_SUFFIX = /,?\s*(usa|u\.s\.a\.|u\.s\.|united states(\s+of\s+america)?)\s*$/i;

/** Street types common enough to mark where a street address stops and the city starts. */
const STREET_PREFIX =
  /^\d+[a-z]?\s+.*?\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|pl|place|ter|terrace|hwy|highway|pkwy|parkway|cir|circle|sq|square|trl|trail|loop|run)\b\.?\s*/i;

const ZIP = /\b\d{5}(?:-\d{4})?\b/;

/** "TX", "California 94063", "Texas" — the tail of an address rather than its city. */
function looksLikeStateSegment(segment: string, totalSegments: number): boolean {
  if (ZIP.test(segment)) return true;
  if (/^[A-Za-z]{2}$/.test(segment)) return true;
  // A spelled-out state is a state wherever it appears, e.g. "... Redwood City, California".
  if (STATE_NAMES[segment.trim().toLowerCase()]) return true;
  return totalSegments >= 3 && /^[A-Za-z][A-Za-z\s.]*$/.test(segment);
}

export function extractCity(address: string | null | undefined): string {
  if (!address || !address.trim()) return "Unknown";

  const cleaned = address.trim().replace(COUNTRY_SUFFIX, "").trim();
  if (!cleaned) return "Unknown";

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "Unknown";

  const last = parts[parts.length - 1];
  const candidate =
    parts.length >= 2 && looksLikeStateSegment(last, parts.length) ? parts[parts.length - 2] : last;

  // "815 Allerton St Redwood City" -> "Redwood City"
  let city = candidate.replace(STREET_PREFIX, "").trim();

  // Anything still carrying a zip is a tail, not a city.
  city = city.replace(ZIP, "").trim();
  city = city.replace(/^[-,\s]+|[-,\s]+$/g, "");

  if (!city || /^\d+$/.test(city)) return "Unknown";

  return titleCase(city);
}

/**
 * Two-letter state code from a US-style address string. Full state names are mapped where they
 * are unambiguous; anything unrecognised gives null rather than a guess.
 */
export function extractState(address: string | null | undefined): string | null {
  if (!address) return null;

  const cleaned = address.trim().replace(COUNTRY_SUFFIX, "").trim();

  // "City, CA 94063" / "City, CA"
  const code = cleaned.match(/,\s*([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (code) return code[1].toUpperCase();

  // "City, California 94063"
  const named = cleaned.match(/,\s*([A-Za-z][A-Za-z\s]+?)(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (named) {
    const key = named[1].trim().toLowerCase();
    return STATE_NAMES[key] ?? null;
  }

  return null;
}

export function extractZip(address: string | null | undefined): string {
  if (!address) return "Unknown";
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : "Unknown";
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};
