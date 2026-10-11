import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePracticeItems, type ModuleContent } from "@/lib/study-content";

const subjects = ["quant","econ","fsa","corp","equity","fi","deriv","pm","alts","ethics"];
it("parses practice sections in every subject", () => {
  for (const s of subjects) {
    const mods = JSON.parse(readFileSync(`/tmp/lessons/${s}.json`, "utf8")) as ModuleContent[];
    let sections = 0, items = 0, noChoices = 0;
    for (const m of mods) for (const sec of m.sections) {
      if (!/practice problem/i.test(sec.title)) continue;
      const parsed = parsePracticeItems(sec.blocks, [sec.title]);
      if (parsed.length) { sections++; items += parsed.length; noChoices += parsed.filter((q) => !q.choices.length).length; }
    }
    console.log(`${s}: ${sections} practice sections, ${items} questions, ${noChoices} without choices`);
    expect(sections).toBeGreaterThan(0);
    expect(noChoices).toBe(0);
  }
});
