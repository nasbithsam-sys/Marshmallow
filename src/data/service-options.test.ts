import { describe, expect, it } from "vitest";
import {
  ALL_SERVICE_OPTIONS,
  SERVICE_CATEGORIES,
  filterServiceCategories,
  isExistingService,
} from "@/data/service-options";

const categoryOf = (service: string) =>
  SERVICE_CATEGORIES.find((group) => (group.services as readonly string[]).includes(service))?.category;

describe("the service catalogue", () => {
  it("lists every service once", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const group of SERVICE_CATEGORIES) {
      for (const service of group.services) {
        const key = service.toLowerCase();
        const existing = seen.get(key);
        if (existing) duplicates.push(`${service}: ${existing} and ${group.category}`);
        else seen.set(key, group.category);
      }
    }

    expect(duplicates).toEqual([]);
  });

  it("has no blank or padded names", () => {
    for (const service of ALL_SERVICE_OPTIONS) {
      expect(service).toBe(service.trim());
      expect(service.length).toBeGreaterThan(0);
    }
  });

  it("files services under the trade that does the work", () => {
    expect(categoryOf("Garage Door Torsion Spring Replacement")).toBe("Garage Services");
    expect(categoryOf("Hot Tub Jet Repair")).toBe("Pool, Spa, and Outdoor Water Features");
    expect(categoryOf("Hot Tub GFCI Troubleshooting")).toBe("Electrical");
    expect(categoryOf("Septic Drain Field Repair")).toBe("Plumbing");
    expect(categoryOf("Mini-Split Refrigerant Recharge")).toBe("Heating, Ventilation, and Air Conditioning");
    expect(categoryOf("EV Charger Troubleshooting")).toBe("Electrical");
    expect(categoryOf("Permanent Christmas Light Installation")).toBe("Electrical");
    expect(categoryOf("Paver Joint Sanding")).toBe("Masonry, Brick, and Concrete");
    expect(categoryOf("Outdoor Kitchen Installation")).toBe("Kitchen Services");
    expect(categoryOf("Outdoor Drain Cleaning")).toBe("Gutters and Drainage");
    expect(categoryOf("Attic Rodent Cleanup")).toBe("Pest and Wildlife Control");
    expect(categoryOf("Wheelchair Lift Repair")).toBe("Accessibility and Aging-in-Place");
  });

  it("finds a service by part of its name", () => {
    expect(filterServiceCategories("torsion").flatMap((group) => group.services)).toEqual([
      "Garage Door Torsion Spring Replacement",
    ]);
    expect(isExistingService("pool liner replacement")).toBe(true);
    expect(isExistingService("Teleportation Repair")).toBe(false);
  });
});
