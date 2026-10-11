import { describe, expect, it } from "vitest";
import { tagSections, sectionsForLos, parsePracticeItems, practiceOnlyModules } from "@/lib/study-content";

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

describe("practice-only portal", () => {
  it("excludes all book reading while retaining practice and answer keys", () => {
    const modules = [{ ...mc, sections: [...mc.sections,
      { title: "Practice Problems", los: [], blocks: [{ t: "p" as const, x: "1. Question A. One B. Two C. Three" }] },
      { title: "Solutions", los: [], blocks: [{ t: "p" as const, x: "1. A is correct." }] },
      { title: "Summary", los: [], blocks: [{ t: "p" as const, x: "Book reading" }] },
    ] }];
    const result = practiceOnlyModules(modules);
    expect(result[0].sections.map(s => s.title)).toEqual(["Practice Problems", "Solutions"]);
    expect(result[0].num).toBe(1);
    expect(result[0].los).toEqual(mc.los);
    expect(modules[0].sections).toHaveLength(7);
  });
  it("retains a module with no practice without falling back to book text", () => {
    expect(practiceOnlyModules([mc])[0].sections).toEqual([]);
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

  const prose = [{ t: "p" as const, x: "1. The short-term shutdown point of production for a firm operating under perfect competition will most likely occur when: A. price is equal to average total cost. B. marginal revenue is equal to marginal cost. C. marginal revenue is equal to average variable costs. 2. Under conditions of perfect competition, a firm produces 50 units. The profit-maximizing output occurs where: A. total revenue is maximized. B. marginal revenue equals marginal cost. C. average cost is minimized." }];
  it("parses the plain-prose layout used outside Quantitative Methods", () => {
    const items = parsePracticeItems(prose);
    expect(items.map((q) => q.n)).toEqual([1, 2]);
    expect(items[0].choices.map((c) => c.label)).toEqual(["A", "B", "C"]);
    expect(items[0].choices[2].text).toContain("average variable costs");
    expect(items[1].stem).toContain("50 units");
  });
  it("keeps a vignette with its item set instead of swallowing it", () => {
    const items = parsePracticeItems([{ t: "p" as const, x: "The following information relates to questions 1-2 Dee’s Arbor Group Inc. is a large investor in timber assets. 1. Which statement is correct? A. One B. Two C. Three 2. What is DAG LP? A. A fund B. A partnership C. A bond" }]);
    expect(items).toHaveLength(2);
    expect(items[0].vignette).toContain("Dee’s Arbor Group");
    expect(items[0].stem).not.toContain("Dee’s Arbor Group");
    expect(items[1].choices).toHaveLength(3);
  });
  it("does not treat numbers inside sentences as new questions", () => {
    const items = parsePracticeItems([{ t: "p" as const, x: "1. A bond pays 8.5% over 30. years, semiannually. The yield is: A. 4.25% B. 8.5% C. 17.0%" }]);
    expect(items).toHaveLength(1);
    expect(items[0].stem).toContain("30. years");
  });
});
