import { describe, expect, it } from "vitest";
import { extractCity, extractState, extractZip } from "@/lib/address-utils";

describe("extractCity", () => {
  it("handles the Google-style address the intake produces", () => {
    // Real shape from a lead: no comma between street and city, country on the end.
    // This used to return "U", taken from "USA".
    expect(extractCity("815 Allerton St Redwood City, California 94063, USA")).toBe("Redwood City");
  });

  it("handles a comma-separated street, city, state and zip", () => {
    expect(extractCity("1200 Main St, Houston, TX 77002")).toBe("Houston");
  });

  it("handles city and state alone", () => {
    expect(extractCity("Houston, TX")).toBe("Houston");
  });

  it("handles a spelled-out state", () => {
    expect(extractCity("500 Congress Ave, Austin, Texas")).toBe("Austin");
  });

  it("handles a spelled-out state with no zip after it", () => {
    expect(extractCity("815 Allerton St Redwood City, California")).toBe("Redwood City");
    expect(extractCity("Houston, Texas")).toBe("Houston");
  });

  it("strips a variety of street types", () => {
    expect(extractCity("88 Oak Avenue Beverly Hills, CA 90210")).toBe("Beverly Hills");
    expect(extractCity("12 Sunset Boulevard Los Angeles, CA 90028")).toBe("Los Angeles");
    expect(extractCity("7 Harbor Way Seattle, WA 98101")).toBe("Seattle");
  });

  it("title-cases whatever it finds", () => {
    expect(extractCity("1200 main st, houston, tx 77002")).toBe("Houston");
  });

  it("returns Unknown when there is nothing to read", () => {
    expect(extractCity("")).toBe("Unknown");
    expect(extractCity(null)).toBe("Unknown");
    expect(extractCity(undefined)).toBe("Unknown");
    expect(extractCity("77002")).toBe("Unknown");
  });
});

describe("extractState", () => {
  it("reads a two-letter code with a zip", () => {
    expect(extractState("1200 Main St, Houston, TX 77002")).toBe("TX");
  });

  it("reads a two-letter code without a zip", () => {
    expect(extractState("Houston, TX")).toBe("TX");
  });

  it("maps a spelled-out state", () => {
    expect(extractState("815 Allerton St Redwood City, California 94063, USA")).toBe("CA");
    expect(extractState("500 Congress Ave, Austin, Texas")).toBe("TX");
  });

  it("gives null rather than guessing", () => {
    expect(extractState("")).toBeNull();
    expect(extractState(null)).toBeNull();
    expect(extractState("Somewhere over the rainbow")).toBeNull();
  });
});

describe("extractZip", () => {
  it("finds the zip", () => {
    expect(extractZip("1200 Main St, Houston, TX 77002")).toBe("77002");
    expect(extractZip("815 Allerton St Redwood City, California 94063-1234, USA")).toBe("94063");
  });

  it("returns Unknown without one", () => {
    expect(extractZip("Houston, TX")).toBe("Unknown");
    expect(extractZip(null)).toBe("Unknown");
  });
});
