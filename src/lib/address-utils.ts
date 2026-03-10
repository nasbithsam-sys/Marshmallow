/**
 * Extract city/area from a US-style address string.
 */
export function extractCity(address: string | null | undefined): string {
  if (!address || !address.trim()) return "Unknown";
  const cleaned = address.trim();

  const match = cleaned.match(/,\s*([^,]+?)\s*,\s*[A-Z]{2}\s*\d{0,5}\s*$/i);
  if (match) return titleCase(match[1].trim());

  const match2 = cleaned.match(/,\s*([^,]+?)\s+[A-Z]{2}\s+\d{5}/i);
  if (match2) return titleCase(match2[1].trim());

  const match3 = cleaned.match(/^([^,]+),\s*[A-Z]{2}$/i);
  if (match3) return titleCase(match3[1].trim());

  const parts = cleaned.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].replace(/\s*\d{5}(-\d{4})?\s*$/, "").replace(/\s*[A-Z]{2}\s*$/i, "").trim();
    const secondLast = parts[parts.length - 2].trim();
    return titleCase(last || secondLast || "Unknown");
  }

  return titleCase(cleaned.split(/\s+/).slice(0, 2).join(" "));
}

export function extractZip(address: string | null | undefined): string {
  if (!address) return "Unknown";
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : "Unknown";
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}