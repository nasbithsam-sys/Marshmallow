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

export type AreaLead = Pick<Lead, "id" | "customer_name" | "status" | "city" | "state"> & {
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
    const city = normalise(lead.city);
    if (!city) continue;
    if (!isOpenLead(lead.status)) continue;

    const state = normalise(lead.state);
    const key = state ? `${city}|${state}` : city;
    const existing = byCity.get(key);

    if (existing) {
      existing.leads.push(lead);
      continue;
    }

    const cityLabel = (lead.city ?? "").trim();
    const stateLabel = (lead.state ?? "").trim();

    byCity.set(key, {
      key,
      label: stateLabel ? `${cityLabel}, ${stateLabel}` : cityLabel,
      city: cityLabel,
      state: stateLabel || null,
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
