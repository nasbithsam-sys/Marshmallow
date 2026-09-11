import { describe, expect, it, vi } from "vitest";

// The ZIP dataset is a 1.8MB JSON loaded lazily in the app; a handful of real centroids is
// enough to test distance behaviour.
const CENTROIDS: Record<string, { latitude: number; longitude: number; city: string; state: string }> = {
  // Houston and a suburb ~22 miles away.
  "77002": { latitude: 29.7573, longitude: -95.3628, city: "Houston", state: "TX" },
  "77494": { latitude: 29.7455, longitude: -95.8285, city: "Katy", state: "TX" },
  // Austin, ~145 miles from Houston.
  "78701": { latitude: 30.2712, longitude: -97.7437, city: "Austin", state: "TX" },
};

vi.mock("@/lib/zipCentroids", async () => {
  const actual = await vi.importActual<typeof import("@/lib/zipCentroids")>("@/lib/zipCentroids");
  return {
    ...actual,
    lookupZipCentroidSync: (zip: string | null | undefined) =>
      zip && CENTROIDS[zip] ? { zip, ...CENTROIDS[zip] } : null,
  };
});

const {
  NEARBY_RADIUS_MILES,
  areLeadsNearby,
  buildNearbyUrgentMap,
  buildUrgentClusters,
  countLeadsInSharedAreas,
  findNearbyUrgentLeads,
  haversineMiles,
  resolveLeadPoint,
} = await import("@/lib/lead-proximity");

type TestLead = Parameters<typeof resolveLeadPoint>[0];

function urgent(id: string, extra: Partial<TestLead> = {}): TestLead {
  return { id, customer_name: `Customer ${id}`, status: "urgent_job", ...extra };
}

describe("haversineMiles", () => {
  it("measures a known distance", () => {
    const houston = { latitude: 29.7573, longitude: -95.3628 };
    const austin = { latitude: 30.2712, longitude: -97.7437 };
    expect(haversineMiles(houston, austin)).toBeGreaterThan(140);
    expect(haversineMiles(houston, austin)).toBeLessThan(150);
  });

  it("is zero for the same point and symmetric", () => {
    const a = { latitude: 29.7573, longitude: -95.3628 };
    const b = { latitude: 30.2712, longitude: -97.7437 };
    expect(haversineMiles(a, a)).toBe(0);
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 6);
  });
});

describe("resolveLeadPoint", () => {
  it("reads coordinates from the zip column", () => {
    const point = resolveLeadPoint(urgent("a", { zip_code: "77002" }));
    expect(point.zip).toBe("77002");
    expect(point.latitude).toBeCloseTo(29.7573, 3);
    expect(point.city).toBe("Houston");
  });

  it("reads the zip out of an address when the column is empty", () => {
    const point = resolveLeadPoint(urgent("a", { address: "1200 Main St, Houston, TX 77002" }));
    expect(point.zip).toBe("77002");
    expect(point.latitude).toBeCloseTo(29.7573, 3);
  });

  it("still gives a city when there is no usable zip", () => {
    const point = resolveLeadPoint(urgent("a", { address: "815 Allerton St Redwood City, California" }));
    expect(point.zip).toBeNull();
    expect(point.latitude).toBeNull();
    expect(point.city).toBe("Redwood City");
  });
});

describe("areLeadsNearby", () => {
  it("pairs two leads inside the radius", () => {
    const houston = resolveLeadPoint(urgent("a", { zip_code: "77002" }));
    const katy = resolveLeadPoint(urgent("b", { zip_code: "77494" }));
    expect(areLeadsNearby(houston, katy)).toBe(true);
  });

  it("does not pair leads beyond it", () => {
    const houston = resolveLeadPoint(urgent("a", { zip_code: "77002" }));
    const austin = resolveLeadPoint(urgent("b", { zip_code: "78701" }));
    expect(areLeadsNearby(houston, austin)).toBe(false);
  });

  it("falls back to the city when coordinates are missing", () => {
    const withZip = resolveLeadPoint(urgent("a", { zip_code: "77002" }));
    const noZip = resolveLeadPoint(urgent("b", { city: "Houston", state: "TX" }));
    expect(areLeadsNearby(withZip, noZip)).toBe(true);
  });

  it("keeps same-named cities in different states apart", () => {
    const illinois = resolveLeadPoint(urgent("a", { city: "Springfield", state: "IL" }));
    const missouri = resolveLeadPoint(urgent("b", { city: "Springfield", state: "MO" }));
    expect(areLeadsNearby(illinois, missouri)).toBe(false);
  });

  it("pairs nothing when a lead has neither zip nor city", () => {
    const known = resolveLeadPoint(urgent("a", { zip_code: "77002" }));
    const unknown = resolveLeadPoint(urgent("b", {}));
    expect(areLeadsNearby(known, unknown)).toBe(false);
  });
});

describe("buildNearbyUrgentMap", () => {
  it("tells every lead in a cluster about the others", () => {
    const leads = [
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "77002" }),
      urgent("c", { zip_code: "77494" }),
    ];

    const map = buildNearbyUrgentMap(leads);

    // Each of the three knows about the other two - no lead is left without the notice.
    expect(map.get("a")?.map((l) => l.id).sort()).toEqual(["b", "c"]);
    expect(map.get("b")?.map((l) => l.id).sort()).toEqual(["a", "c"]);
    expect(map.get("c")?.map((l) => l.id).sort()).toEqual(["a", "b"]);
  });

  it("ignores leads that are not urgent", () => {
    const leads = [
      urgent("a", { zip_code: "77002" }),
      { ...urgent("b", { zip_code: "77002" }), status: "scheduled" as const },
    ];

    expect(buildNearbyUrgentMap(leads).size).toBe(0);
  });

  it("leaves a lone urgent lead out", () => {
    expect(buildNearbyUrgentMap([urgent("a", { zip_code: "77002" })]).size).toBe(0);
  });

  it("does not pair leads that are far apart", () => {
    const map = buildNearbyUrgentMap([
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "78701" }),
    ]);

    expect(map.size).toBe(0);
  });

  it("respects a custom radius", () => {
    const leads = [urgent("a", { zip_code: "77002" }), urgent("b", { zip_code: "77494" })];
    expect(buildNearbyUrgentMap(leads, 5).size).toBe(0);
    expect(buildNearbyUrgentMap(leads, NEARBY_RADIUS_MILES).size).toBe(2);
  });
});

describe("buildUrgentClusters", () => {
  it("groups the leads of one area together", () => {
    const clusters = buildUrgentClusters([
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "77494" }),
      urgent("c", { zip_code: "78701" }),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].leads.map((l) => l.id).sort()).toEqual(["a", "b"]);
    expect(clusters[0].label).toBe("Houston, TX");
  });

  it("keeps separate areas separate, biggest first", () => {
    const clusters = buildUrgentClusters([
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "77002" }),
      urgent("c", { zip_code: "77494" }),
      urgent("d", { city: "Denver", state: "CO" }),
      urgent("e", { city: "Denver", state: "CO" }),
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].leads).toHaveLength(3);
    expect(clusters[1].leads).toHaveLength(2);
  });

  it("counts the leads sharing an area", () => {
    const clusters = buildUrgentClusters([
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "77494" }),
      urgent("c", { city: "Denver", state: "CO" }),
      urgent("d", { city: "Denver", state: "CO" }),
      urgent("e", { zip_code: "78701" }),
    ]);

    expect(countLeadsInSharedAreas(clusters)).toBe(4);
  });

  it("is empty when nothing is clustered", () => {
    expect(buildUrgentClusters([urgent("a", { zip_code: "77002" })])).toEqual([]);
    expect(countLeadsInSharedAreas([])).toBe(0);
  });
});

describe("findNearbyUrgentLeads", () => {
  it("lists the urgent leads near one lead", () => {
    const target = urgent("a", { zip_code: "77002" });
    const leads = [target, urgent("b", { zip_code: "77494" }), urgent("c", { zip_code: "78701" })];
    expect(findNearbyUrgentLeads(target, leads).map((l) => l.id)).toEqual(["b"]);
  });

  it("never lists the lead itself", () => {
    const target = urgent("a", { zip_code: "77002" });
    expect(findNearbyUrgentLeads(target, [target])).toEqual([]);
  });

  it("returns nothing for a lead that is not urgent", () => {
    const target = { ...urgent("a", { zip_code: "77002" }), status: "scheduled" as const };
    expect(findNearbyUrgentLeads(target, [urgent("b", { zip_code: "77002" })])).toEqual([]);
  });

  it("agrees with the map the lead card uses", () => {
    const leads = [
      urgent("a", { zip_code: "77002" }),
      urgent("b", { zip_code: "77494" }),
      urgent("c", { zip_code: "77002" }),
      urgent("d", { zip_code: "78701" }),
    ];
    const map = buildNearbyUrgentMap(leads);

    for (const lead of leads) {
      const fromDetail = findNearbyUrgentLeads(lead, leads).map((l) => l.id).sort();
      const fromCard = (map.get(lead.id) ?? []).map((l) => l.id).sort();
      expect(fromDetail).toEqual(fromCard);
    }
  });
});
