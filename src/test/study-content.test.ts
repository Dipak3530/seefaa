import { describe, expect, it } from "vitest";
import { tagSections, sectionsForLos, parsePracticeItems } from "@/lib/study-content";

const mc = { num: 1, los: ["determine and interpret breakeven points", "describe market structures"], sections: [
  { title: "Overview", los: [], blocks: [{ t: "p" as const, x: "intro" }] },
  { title: "Breakeven", los: [2], blocks: [{ t: "p" as const, x: "determine and interpret breakeven points" }, { t: "p" as const, x: "body" }] },
  { title: "Sub topic", los: [], blocks: [{ t: "p" as const, x: "more" }] },
  { title: "Structures", los: [], blocks: [{ t: "p" as const, x: "describe market structures" }] },
] };

describe("study content LOS tagging", () => {
  it("uses the LOS quoted at the top of a lesson over margin numbers", () => {
    expect(tagSections(mc)[1].los).toEqual([1]);
  });
  it("carries a lesson's LOS into its untagged sub-sections", () => {
    expect(tagSections(mc)[2].los).toEqual([1]);
  });
  it("filters lessons to a single LOS", () => {
    expect(sectionsForLos(tagSections(mc), 2).map((s) => s.title)).toEqual(["Structures"]);
  });
});

describe("practice problem parsing", () => {
  const blocks = [{ t: "p" as const, x: "1.\t An investor purchased 100 shares for NOK34.50. The holding period return is closest to: A.\t −13.08%. B.\t −11.59%. C.\t −10.10%. 2.\t An analyst obtains returns: Year 1 14.0 Year 2 −10.0. The return is closest to: Returns of Financial Assets and Instruments A.\t 0.18%. B.\t 0.55%. C.\t 1.65%." }];
  it("splits run-on text into numbered questions", () => {
    const items = parsePracticeItems(blocks, ["Practice Problems", "Returns of Financial Assets and Instruments"]);
    expect(items.map((q) => q.n)).toEqual([1, 2]);
    expect(items[0].stem).toContain("NOK34.50");
  });
  it("extracts A/B/C choices and strips embedded page headers", () => {
    const items = parsePracticeItems(blocks, ["Practice Problems", "Returns of Financial Assets and Instruments"]);
    expect(items[0].choices.map((c) => c.label)).toEqual(["A", "B", "C"]);
    expect(items[0].choices[0].text).toBe("−13.08%.");
    expect(items[1].stem).not.toContain("Returns of Financial Assets");
    expect(items[1].choices).toHaveLength(3);
  });
  it("returns no items for ordinary prose", () => {
    expect(parsePracticeItems([{ t: "p" as const, x: "Just a paragraph about returns." }])).toEqual([]);
  });
});
