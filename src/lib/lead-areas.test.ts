import { describe, expect, it } from "vitest";
import {
  countGroupedLeads,
  groupLeadsByArea,
  isOpenLead,
  resolveLeadArea,
  type AreaLead,
} from "@/lib/lead-areas";
import type { LeadStatus } from "@/types";

function lead(id: string, city: string | null, state: string | null, status: LeadStatus = "needs_quote"): AreaLead {
  return { id, customer_name: `Customer ${id}`, status, city, state };
}

describe("grouping leads by area", () => {
  it("groups leads that share a city", () => {
    const groups = groupLeadsByArea([
      lead("a", "Houston", "TX"),
      lead("b", "Houston", "TX"),
      lead("c", "Austin", "TX"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Houston, TX");
    expect(groups[0].leads.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("ignores a city with only one lead", () => {
    expect(groupLeadsByArea([lead("a", "Austin", "TX")])).toEqual([]);
  });

  it("matches cities regardless of spacing and case", () => {
    const groups = groupLeadsByArea([
      lead("a", "houston", "tx"),
      lead("b", "  Houston ", "TX "),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].leads).toHaveLength(2);
  });

  it("keeps same-named cities in different states apart", () => {
    expect(
      groupLeadsByArea([lead("a", "Springfield", "IL"), lead("b", "Springfield", "MO")]),
    ).toEqual([]);
  });

  it("skips leads with no city", () => {
    expect(groupLeadsByArea([lead("a", null, "TX"), lead("b", "", "TX")])).toEqual([]);
  });

  it("leaves closed leads out, so they cannot form a group", () => {
    const groups = groupLeadsByArea([
      lead("a", "Houston", "TX", "cancelled"),
      lead("b", "Houston", "TX", "paid"),
      lead("c", "Houston", "TX", "job_done"),
      lead("d", "Houston", "TX", "scammed"),
      lead("e", "Houston", "TX"),
    ]);

    expect(groups).toEqual([]);
  });

  it("still groups the open leads beside closed ones", () => {
    const groups = groupLeadsByArea([
      lead("a", "Houston", "TX", "cancelled"),
      lead("b", "Houston", "TX"),
      lead("c", "Houston", "TX", "scheduled"),
    ]);

    expect(groups[0].leads.map((l) => l.id)).toEqual(["b", "c"]);
  });

  it("puts the biggest group first, then sorts by name", () => {
    const groups = groupLeadsByArea([
      lead("a", "Austin", "TX"),
      lead("b", "Austin", "TX"),
      lead("c", "Houston", "TX"),
      lead("d", "Houston", "TX"),
      lead("e", "Houston", "TX"),
      lead("f", "Dallas", "TX"),
      lead("g", "Dallas", "TX"),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["Houston, TX", "Austin, TX", "Dallas, TX"]);
  });

  it("handles a city with no state", () => {
    const groups = groupLeadsByArea([lead("a", "Houston", null), lead("b", "Houston", "")]);
    expect(groups[0].label).toBe("Houston");
    expect(groups[0].state).toBeNull();
  });
});

describe("countGroupedLeads", () => {
  it("adds up the leads across every group", () => {
    const groups = groupLeadsByArea([
      lead("a", "Austin", "TX"),
      lead("b", "Austin", "TX"),
      lead("c", "Houston", "TX"),
      lead("d", "Houston", "TX"),
      lead("e", "Houston", "TX"),
    ]);

    expect(countGroupedLeads(groups)).toBe(5);
  });

  it("is zero with no groups", () => {
    expect(countGroupedLeads([])).toBe(0);
  });
});

describe("isOpenLead", () => {
  it("treats working statuses as open", () => {
    expect(isOpenLead("needs_quote")).toBe(true);
    expect(isOpenLead("scheduled")).toBe(true);
  });

  it("treats finished and cancelled ones as closed", () => {
    expect(isOpenLead("cancelled")).toBe(false);
    expect(isOpenLead("paid")).toBe(false);
    expect(isOpenLead("job_done")).toBe(false);
    expect(isOpenLead("scammed")).toBe(false);
  });

  it("handles missing status", () => {
    expect(isOpenLead(null)).toBe(false);
    expect(isOpenLead(undefined)).toBe(false);
  });
});

function addressLead(id: string, address: string, status: LeadStatus = "needs_quote"): AreaLead {
  return { id, customer_name: `Customer ${id}`, status, city: null, state: null, address };
}

describe("falling back to the address", () => {
  // The city column is only populated by some intake paths, so most leads carry the location
  // in the address string alone.
  it("reads the city out of a full US address", () => {
    expect(resolveLeadArea(addressLead("a", "815 Allerton St Redwood City, California 94063, USA"))).toEqual({
      city: "Redwood City",
      state: "CA",
    });
  });

  it("reads the city and state code out of an address", () => {
    expect(resolveLeadArea(addressLead("a", "1200 Main St, Houston, TX 77002"))).toEqual({
      city: "Houston",
      state: "TX",
    });
  });

  it("groups leads that only have addresses", () => {
    const groups = groupLeadsByArea([
      addressLead("a", "1200 Main St, Houston, TX 77002"),
      addressLead("b", "88 Oak Ave, Houston, TX 77004"),
      addressLead("c", "5 Pine Rd, Austin, TX 78701"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Houston, TX");
    expect(groups[0].leads.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("prefers the column when it is filled", () => {
    const withBoth: AreaLead = {
      id: "a",
      customer_name: "Customer a",
      status: "needs_quote",
      city: "Houston",
      state: "TX",
      address: "1200 Main St, Austin, TX 78701",
    };

    expect(resolveLeadArea(withBoth)).toEqual({ city: "Houston", state: "TX" });
  });

  it("gives up when there is no usable address", () => {
    expect(resolveLeadArea(addressLead("a", ""))).toBeNull();
    expect(resolveLeadArea({ id: "b", customer_name: "b", status: "needs_quote" })).toBeNull();
  });

  it("does not lump unparseable leads together", () => {
    const groups = groupLeadsByArea([addressLead("a", ""), addressLead("b", "")]);
    expect(groups).toEqual([]);
  });
});
