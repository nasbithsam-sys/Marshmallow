import { describe, expect, it } from "vitest";
import {
  buildTechTemplate,
  countTechs,
  findTechNumbers,
  formatTechCount,
  nextTechNumber,
} from "@/lib/lead-techs";

const TECH_ONE = "Tech 1\nName: Alex\nNumber: 555-0100";
const TECH_TWO = "Tech 2\nName: Sam\nNumber: 555-0111";

describe("finding techs in note text", () => {
  it("reads the numbers out of a note", () => {
    expect(findTechNumbers(`${TECH_ONE}\n\n${TECH_TWO}`)).toEqual([1, 2]);
  });

  it("tolerates the spacing and casing people actually type", () => {
    expect(findTechNumbers("  tech 4  \nName: Jo")).toEqual([4]);
    expect(findTechNumbers("TECH#7\nName: Kim")).toEqual([7]);
  });

  it("ignores prose that merely mentions a tech", () => {
    expect(findTechNumbers("Called the tech 2 times, no answer")).toEqual([]);
    expect(findTechNumbers("tech arriving soon")).toEqual([]);
  });

  it("handles empty input", () => {
    expect(findTechNumbers(null)).toEqual([]);
    expect(findTechNumbers(undefined)).toEqual([]);
    expect(findTechNumbers("")).toEqual([]);
  });
});

describe("counting techs across a thread", () => {
  it("adds up entries from separate notes", () => {
    expect(countTechs([TECH_ONE, TECH_TWO])).toBe(2);
  });

  it("counts several entries inside one note", () => {
    expect(countTechs([`${TECH_ONE}\n${TECH_TWO}`])).toBe(2);
  });

  it("is zero for a thread with no techs", () => {
    expect(countTechs(["Customer called back", null])).toBe(0);
  });
});

describe("numbering the next tech", () => {
  it("starts at 1 on an empty thread", () => {
    expect(nextTechNumber([])).toBe(1);
    expect(nextTechNumber(["No techs here"])).toBe(1);
  });

  it("continues past the highest number used", () => {
    expect(nextTechNumber([TECH_ONE, TECH_TWO])).toBe(3);
  });

  it("does not reuse a number when an earlier tech was deleted", () => {
    // Tech 2 removed, Tech 3 still on screen — the next one must be 4, not 3.
    expect(nextTechNumber(["Tech 1\nName: Alex", "Tech 3\nName: Rae"])).toBe(4);
  });

  it("counts a draft that is still being typed", () => {
    const draft = buildTechTemplate(nextTechNumber([TECH_ONE]));
    expect(draft.startsWith("Tech 2")).toBe(true);
    expect(nextTechNumber([TECH_ONE, draft])).toBe(3);
  });
});

describe("formatTechCount", () => {
  it("uses the singular for one", () => {
    expect(formatTechCount(1)).toBe("1 tech");
  });

  it("uses the plural otherwise", () => {
    expect(formatTechCount(0)).toBe("0 techs");
    expect(formatTechCount(4)).toBe("4 techs");
  });
});
