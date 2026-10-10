import { describe, expect, it } from "vitest";
import { REFERENCE_FORMULAS, REFERENCE_SUBJECTS, referenceMatches } from "../lib/formula-reference";

describe("uploaded subject-wise formula reference", () => {
  it("groups the sheet into ten subjects without assigning modules", () => {
    expect(REFERENCE_SUBJECTS).toHaveLength(10);
    expect(REFERENCE_FORMULAS.length).toBeGreaterThan(100);
    for (const formula of REFERENCE_FORMULAS) {
      expect(REFERENCE_SUBJECTS).toContain(formula.subject);
      expect(formula).not.toHaveProperty("module_id");
      expect(formula.page).toBeGreaterThanOrEqual(1);
      expect(formula.page).toBeLessThanOrEqual(12);
    }
    expect(new Set(REFERENCE_FORMULAS.map((f) => f.id)).size).toBe(REFERENCE_FORMULAS.length);
  });
  it("filters by subject and searches the source expressions", () => {
    const result = REFERENCE_FORMULAS.filter((f) => referenceMatches(f, "Corporate Issuers", "WACC"));
    expect(result).toHaveLength(1);
    expect(result[0]?.expression).toBe("WACC = wd kd(1 − t) + wps kps + wce ks");
    expect(REFERENCE_FORMULAS.filter((f) => referenceMatches(f, "Economics", "WACC"))).toHaveLength(0);
  });
  it("flags the printed terminal-value discrepancy rather than treating it as verified", () => {
    const formula = REFERENCE_FORMULAS.find((f) => f.name === "Multistage terminal value — source discrepancy");
    expect(formula?.expression).toBe("Printed: Pn = Dn+1 / (ke + gc)");
    expect(formula?.note).toContain("ke − gc");
  });
  it("does not invent Ethics equations when the sheet contains only standards", () => {
    expect(REFERENCE_FORMULAS.filter((f) => f.subject === "Ethical and Professional Standards")).toHaveLength(0);
  });
  it("includes the page-five EPS equations", () => {
    const eps = REFERENCE_FORMULAS.filter((f) => f.name.includes("earnings per share") || f.name.startsWith("Diluted EPS"));
    expect(eps).toHaveLength(3);
    expect(eps.every((f) => f.subject === "Financial Statement Analysis" && f.page === 5)).toBe(true);
  });
});