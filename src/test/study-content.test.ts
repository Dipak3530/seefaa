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
