import { it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePracticeItems, type ModuleContent } from "@/lib/study-content";

const subjects = ["quant","econ","fsa","corp","equity","fi","deriv","pm","alts","ethics"];
it("report", () => {
  for (const s of subjects) {
    const mods = JSON.parse(readFileSync(`/tmp/lessons/${s}.json`, "utf8")) as ModuleContent[];
    let sections = 0, items = 0, noChoices = 0; const samples: string[] = [];
    for (const m of mods) for (const sec of m.sections) {
      if (!/practice problem/i.test(sec.title)) continue;
      const parsed = parsePracticeItems(sec.blocks, [sec.title, `Module ${m.num}`]);
      if (parsed.length) { sections++; items += parsed.length;
        for (const q of parsed) if (!q.choices.length) { noChoices++; if (samples.length < 2) samples.push(`m${m.num} q${q.n}: ${q.stem.slice(0,140)}`); } }
    }
    console.log(`${s}: ${sections} sections, ${items} q, ${noChoices} no-choice`);
    samples.forEach((x) => console.log("   " + x));
  }
});
