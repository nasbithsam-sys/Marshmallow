import { extractCity, extractState } from "@/lib/address-utils";
import { lookupZipCentroidSync, resolveZip } from "@/lib/zipCentroids";
import type { Lead, LeadStatus } from "@/types";

/**
 * Urgent jobs sitting close to each other, so a lead card can say another urgent job is nearby
 * instead of that being noticed by chance.
 *
 * Distance is real: every US ZIP centroid ships with the app (the same dataset Map View uses),
 * so two leads are compared by coordinates without any geocoding call. Accuracy is
 * ZIP-centroid level - a few miles either way - which is fine at a 50 mile radius. When a lead
 * has no usable ZIP it falls back to matching on city, which is why a lead with neither a ZIP
 * nor a readable city is never paired with anything.
 */

export const NEARBY_RADIUS_MILES = 50;

const EARTH_RADIUS_MILES = 3958.8;

export type ProximityLead = Pick<Lead, "id" | "customer_name" | "status"> & {
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  address?: string | null;
  job_id?: string | null;
};

export interface LeadPoint {
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in miles. Symmetric, so "A is near B" always implies "B is near A". */
export function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Where a lead is: coordinates from its ZIP when one can be found, plus a city for the fallback.
 * The ZIP dataset loads lazily, so coordinates are null until it is in memory - callers should
 * recompute once it is.
 */
export function resolveLeadPoint(lead: ProximityLead): LeadPoint {
  const zip = resolveZip({ zip_code: lead.zip_code, address: lead.address });
  const centroid = zip ? lookupZipCentroidSync(zip) : null;

  const cityColumn = (lead.city ?? "").trim();
  const city = cityColumn || centroid?.city || null;
  const derivedCity = city || (extractCity(lead.address) !== "Unknown" ? extractCity(lead.address) : null);

  return {
    city: derivedCity,
    state: (lead.state ?? "").trim() || centroid?.state || extractState(lead.address),
    zip,
    latitude: centroid?.latitude ?? null,
    longitude: centroid?.longitude ?? null,
  };
}

export function isUrgentLead(status: string | null | undefined): boolean {
  return status === ("urgent_job" satisfies LeadStatus);
}

/** True when two leads are within the radius, or share a city when either lacks coordinates. */
export function areLeadsNearby(
  a: LeadPoint,
  b: LeadPoint,
  radiusMiles: number = NEARBY_RADIUS_MILES,
): boolean {
  if (
    a.latitude !== null &&
    a.longitude !== null &&
    b.latitude !== null &&
    b.longitude !== null
  ) {
    const distance = haversineMiles(
      { latitude: a.latitude, longitude: a.longitude },
      { latitude: b.latitude, longitude: b.longitude },
    );
    if (distance <= radiusMiles) return true;
  }

  // No coordinates on one side: the city is all there is to go on.
  const cityA = normalise(a.city);
  const cityB = normalise(b.city);
  if (!cityA || !cityB || cityA !== cityB) return false;

  const stateA = normalise(a.state);
  const stateB = normalise(b.state);
  // Two cities of the same name in different states are not the same place.
  return !stateA || !stateB || stateA === stateB;
}

/**
 * For every urgent lead, the other urgent leads near it. Because nearness is symmetric, each
 * lead in a cluster lists the others - none of them is left without the notice.
 */
export function buildNearbyUrgentMap(
  leads: ProximityLead[],
  radiusMiles: number = NEARBY_RADIUS_MILES,
): Map<string, ProximityLead[]> {
  const urgent = leads.filter((lead) => isUrgentLead(lead.status));
  const points = new Map<string, LeadPoint>();
  urgent.forEach((lead) => points.set(lead.id, resolveLeadPoint(lead)));

  const result = new Map<string, ProximityLead[]>();

  for (let i = 0; i < urgent.length; i += 1) {
    for (let j = i + 1; j < urgent.length; j += 1) {
      const a = urgent[i];
      const b = urgent[j];
      const pointA = points.get(a.id);
      const pointB = points.get(b.id);
      if (!pointA || !pointB) continue;
      if (!areLeadsNearby(pointA, pointB, radiusMiles)) continue;

      if (!result.has(a.id)) result.set(a.id, []);
      if (!result.has(b.id)) result.set(b.id, []);
      result.get(a.id)!.push(b);
      result.get(b.id)!.push(a);
    }
  }

  return result;
}

/**
 * The urgent leads near one lead, for a page that shows a single lead rather than a list.
 * Same rule as buildNearbyUrgentMap, so the detail page and the card never disagree.
 */
export function findNearbyUrgentLeads(
  target: ProximityLead,
  leads: ProximityLead[],
  radiusMiles: number = NEARBY_RADIUS_MILES,
): ProximityLead[] {
  if (!isUrgentLead(target.status)) return [];

  const targetPoint = resolveLeadPoint(target);
  return leads.filter(
    (lead) =>
      lead.id !== target.id &&
      isUrgentLead(lead.status) &&
      areLeadsNearby(targetPoint, resolveLeadPoint(lead), radiusMiles),
  );
}

export interface UrgentCluster {
  key: string;
  /** "Houston, TX" — where the cluster is, taken from its first lead. */
  label: string;
  leads: ProximityLead[];
}

/**
 * Urgent leads collected into clusters for reporting. Built by walking the nearby map, so a
 * chain of leads that are each within the radius of the next counts as one area.
 */
export function buildUrgentClusters(
  leads: ProximityLead[],
  radiusMiles: number = NEARBY_RADIUS_MILES,
): UrgentCluster[] {
  const nearby = buildNearbyUrgentMap(leads, radiusMiles);
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const seen = new Set<string>();
  const clusters: UrgentCluster[] = [];

  for (const leadId of nearby.keys()) {
    if (seen.has(leadId)) continue;

    const members: ProximityLead[] = [];
    const queue = [leadId];
    seen.add(leadId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = byId.get(currentId);
      if (current) members.push(current);

      for (const neighbour of nearby.get(currentId) ?? []) {
        if (seen.has(neighbour.id)) continue;
        seen.add(neighbour.id);
        queue.push(neighbour.id);
      }
    }

    if (members.length < 2) continue;

    const point = resolveLeadPoint(members[0]);
    const label = point.city
      ? point.state
        ? `${point.city}, ${point.state}`
        : point.city
      : "Unknown area";

    clusters.push({ key: members[0].id, label, leads: members });
  }

  return clusters.sort((a, b) => b.leads.length - a.leads.length || a.label.localeCompare(b.label));
}

/** How many urgent leads are currently sharing an area with at least one other. */
export function countLeadsInSharedAreas(clusters: UrgentCluster[]): number {
  return clusters.reduce((total, cluster) => total + cluster.leads.length, 0);
}
