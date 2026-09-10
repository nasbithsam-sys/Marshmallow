import { extractCity, extractState } from "@/lib/address-utils";
import type { Lead, LeadStatus } from "@/types";

/**
 * Leads that sit in the same city, so several jobs in one area can be seen and scheduled
 * together instead of being spotted by chance while scrolling.
 *
 * Only open work is grouped: a finished or cancelled lead in Houston does not make the two live
 * ones there any more interesting.
 */

const CLOSED_STATUSES: ReadonlySet<string> = new Set<LeadStatus>([
  "cancelled",
  "paid",
  "job_done",
  "scammed",
]);

export type AreaLead = Pick<Lead, "id" | "customer_name" | "status"> & {
  city?: string | null;
  state?: string | null;
  job_id?: string | null;
  address?: string | null;
  created_at?: string;
};

export interface LeadAreaGroup {
  /** Stable key for rendering: normalised city + state. */
  key: string;
  /** "Houston, TX" — as typed on the first lead in the group. */
  label: string;
  city: string;
  state: string | null;
  leads: AreaLead[];
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Where a lead is. The `city` column is only filled in by some intake paths, so the address is
 * parsed as a fallback — the same approach the Areas page takes. Returns null when neither
 * source yields a real city.
 */
export function resolveLeadArea(lead: AreaLead): { city: string; state: string | null } | null {
  const column = (lead.city ?? "").trim();
  if (column) {
    return { city: column, state: (lead.state ?? "").trim() || extractState(lead.address) };
  }

  const derived = extractCity(lead.address);
  if (!derived || derived === "Unknown") return null;

  return { city: derived, state: (lead.state ?? "").trim() || extractState(lead.address) };
}

/**
 * The label a lead groups under - "Houston, TX" - and the value carried in the ?area= param so
 * an area view can be linked to and reloaded. Null when the lead has no usable location.
 */
export function leadAreaLabel(lead: AreaLead): string | null {
  const area = resolveLeadArea(lead);
  if (!area) return null;
  return area.state ? `${area.city}, ${area.state}` : area.city;
}

/** Case- and spacing-insensitive match against an ?area= value. */
export function isLeadInArea(lead: AreaLead, areaLabel: string): boolean {
  const label = leadAreaLabel(lead);
  return Boolean(label) && normalise(label) === normalise(areaLabel);
}

export function isOpenLead(status: string | null | undefined): boolean {
  return Boolean(status) && !CLOSED_STATUSES.has(status as string);
}

/**
 * Groups open leads by city, keeping only cities with more than one. Biggest groups first, then
 * alphabetical so the order does not jump around as leads change.
 */
export function groupLeadsByArea(leads: AreaLead[]): LeadAreaGroup[] {
  const byCity = new Map<string, LeadAreaGroup>();

  for (const lead of leads) {
    if (!isOpenLead(lead.status)) continue;

    const area = resolveLeadArea(lead);
    if (!area) continue;

    const city = normalise(area.city);
    const state = normalise(area.state);
    const key = state ? `${city}|${state}` : city;
    const existing = byCity.get(key);

    if (existing) {
      existing.leads.push(lead);
      continue;
    }

    byCity.set(key, {
      key,
      label: area.state ? `${area.city}, ${area.state}` : area.city,
      city: area.city,
      state: area.state,
      leads: [lead],
    });
  }

  return [...byCity.values()]
    .filter((group) => group.leads.length > 1)
    .sort((a, b) => b.leads.length - a.leads.length || a.label.localeCompare(b.label));
}

/** Total leads sitting in a shared area — what the section badge counts. */
export function countGroupedLeads(groups: LeadAreaGroup[]): number {
  return groups.reduce((total, group) => total + group.leads.length, 0);
}
