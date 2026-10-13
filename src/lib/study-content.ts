import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Private source extracts; only practice sections are exposed in the portal. */
export type ContentBlock = { t: "p" | "h" | "table"; x: string };
export type ContentSection = { title: string; los: number[]; blocks: ContentBlock[] };
export type ModuleContent = { num: number; los: string[]; sections: ContentSection[] };

export function moduleNumber(moduleId: string) {
  const m = moduleId.match(/-m(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Keep question sets and their source answer keys, never textbook reading sections. */
export function practiceOnlyModules(modules: ModuleContent[]): ModuleContent[] {
  return modules.map((module) => ({
    ...module,
    sections: module.sections.filter((section) => /practice problems?/i.test(section.title) || /^solutions?$/i.test(section.title.trim())),
  }));
}

export function useSubjectContent(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["study-practice-content", subjectId],
    enabled: !!subjectId,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("curriculum-content").download(`2027/${subjectId}.json`);
      if (error) throw error;
      return practiceOnlyModules(JSON.parse(await data.text()) as ModuleContent[]);
    },
  });
}

/** Lessons open by quoting the LOS they cover; prefer that over margin numbers, carrying tags into sub-sections. */
export function tagSections(mc: ModuleContent): ContentSection[] {
  const key = (t: string) => t.toLowerCase().replace(/[^a-z]/g, "").slice(0, 50);
  const keys = mc.los.map(key);
  let last: number[] = [];
  return mc.sections.map((s) => {
    const quoted = s.blocks.slice(0, 4).flatMap((b) => keys.map((k, i) => (k && key(b.x).startsWith(k) ? i + 1 : 0))).filter(Boolean);
    const tags = quoted.length ? [...new Set(quoted)] : s.los.length ? s.los : /overview|practice|solution|summary/i.test(s.title) ? [] : last;
    if (quoted.length || s.los.length) last = tags;
    return { ...s, los: tags };
  });
}

/** Sections that teach a given LOS number; untagged sections (overview, practice) appear only under "All". */
export function sectionsForLos(sections: ContentSection[], los: number | null) {
  if (los == null) return sections;
  return sections.filter((s) => s.los.includes(los));
}

export type PracticeQuestion = { n: number; stem: string; choices: { label: string; text: string }[]; vignette?: string; solution?: string };

/**
 * Split a run-on "Practice Problems" / "Solutions" extraction into numbered items.
 * Two source layouts exist: tab-delimited ("1.\t stem A.\t x. …", Quant) and plain
 * prose ("1. stem A. x. B. y. C. z. 2. …", all other subjects), the latter often
 * opening with a vignette ("The following information relates to questions 1-5 …").
 * Numbering must run sequentially and choices must ascend from A, so stray numbers
 * and abbreviations inside the text are not mistaken for question or choice starts.
 * Presentation only — never invents or alters content.
 */
export function parsePracticeItems(blocks: ContentBlock[], noise: string[] = []): PracticeQuestion[] {
  let text = blocks.map((b) => b.t === "table" ? formatSourceTable(b.x, noise) : b.x).join("\n\n").replace(/­/g, "").trim();
  for (const n of noise) if (n) text = text.split(n).join(" ");
  // A heading belongs to the answer-key run, never to the final answer choice.
  text = text.replace(/(?:^|\n)\s*Solutions?\s*(?=\n|$)/gi, "\n\n");
  const tabbed = splitNumbered(text, /(\d{1,2})\.\t/, /([A-F])\.\t/);
  return separateScenarios(mergeSolutions(tabbed.length >= 2 ? tabbed : splitProse(text)));
}

/** Keep source line breaks and values, including empty cells; never supply missing figures. */
function formatSourceTable(text: string, noise: string[]): string {
  let rows = text.split("\n").filter(line => !noise.some(n => n && line.trim().startsWith(`${n} |`)));
  // This source exhibit repeats a wrapped header at a page break. Investment dates
  // are explicitly stated in the question; blank cells remain blank, not guessed.
  if (text.includes("Investor A’s | Investor B’s | Investor C’s") && text.includes("Annual Gross | Investment")) {
    const data = rows.filter(line => /^\d+\s*\|/.test(line));
    rows = ["Year | Annual gross return | Investor A (€ millions) | Investor B (€ millions) | Investor C (€ millions)", ...data.map(line => {
      const cells = line.split("|").map(c => c.trim());
      if (cells[0] === "3" && cells.length === 4 && cells[3] === "100") cells.splice(3, 0, "");
      return cells.join(" | ");
    })];
  }
  const cells = rows.map(line => line.split("|").map(c => c.trim()));
  if (!cells.length) return "";
  const width = Math.max(...cells.map(row => row.length));
  const render = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
  return [render(cells[0]), render(Array(width).fill("---")), ...cells.slice(1).map(render)].join("\n");
}

/** A shared scenario starts after the previous choice and belongs to its stated question range. */
function separateScenarios(items: PracticeQuestion[]): PracticeQuestion[] {
  const scenarios: { from: number; to: number; text: string }[] = [];
  const marker = /The following (?:information|exhibit|data) (?:relates|applies) to questions?\s+(\d+)\s*[-–−]\s*(\d+)/i;
  for (const q of items) {
    if (q.vignette) {
      const match = q.vignette.match(marker);
      if (match) scenarios.push({ from: Number(match[1]), to: Number(match[2]), text: q.vignette });
    }
    for (const choice of q.choices) {
      const match = marker.exec(choice.text);
      if (!match) continue;
      scenarios.push({ from: Number(match[1]), to: Number(match[2]), text: choice.text.slice(match.index).trim() });
      choice.text = choice.text.slice(0, match.index).trim();
    }
  }
  for (const q of items) {
    const scenario = scenarios.find(s => q.n >= s.from && q.n <= s.to);
    if (scenario) q.vignette = scenario.text;
  }
  return items;
}

const SOLUTION_PHRASING = /^([A-F])\s+is correct|^The correct (?:response|answer) is/i;

/**
 * Many practice sections append their answer key as a second numbered run
 * (restarting at 1) or as paragraphs phrased "B is correct. …". Those are not
 * questions: fold them onto the question with the same number as its solution.
 */
function mergeSolutions(items: PracticeQuestion[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  const byN = new Map<number, PracticeQuestion>();
  let solutionRun = false;
  for (const q of items) {
    if (!solutionRun && out.length && q.n <= out[out.length - 1].n) solutionRun = true;
    if (solutionRun || SOLUTION_PHRASING.test(q.stem)) {
      const target = byN.get(q.n);
      if (target) {
        const text = [q.stem, ...q.choices.map((c) => `${c.label}. ${c.text}`)].join(" ");
        target.solution = [target.solution, text].filter(Boolean).join(" ");
      }
      continue;
    }
    byN.set(q.n, q);
    out.push(q);
  }
  return out;
}

/** The verified correct letter when the source solution states one. */
export function solutionLetter(q: PracticeQuestion): string | null {
  const m = q.solution?.match(/^([A-F])\s+is correct|^The correct (?:response|answer) is\s+([A-F])/i);
  return m ? (m[1] ?? m[2]).toUpperCase() : null;
}

function splitNumbered(text: string, numRe: RegExp, choiceRe: RegExp): PracticeQuestion[] {
  const parts = text.split(numRe);
  const items: PracticeQuestion[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const n = Number(parts[i]);
    const body = parts[i + 1].trim();
    if (!n || !body) continue;
    items.push({ n, ...splitChoices(body, choiceRe) });
  }
  return items;
}

function splitChoices(body: string, choiceRe: RegExp): { stem: string; choices: { label: string; text: string }[] } {
  const segs = body.split(choiceRe);
  const stem = segs[0].trim();
  const choices: { label: string; text: string }[] = [];
  for (let j = 1; j + 1 < segs.length; j += 2) {
    const ct = segs[j + 1].trim();
    if (ct) choices.push({ label: segs[j], text: ct });
  }
  return { stem, choices };
}

/** Prose layout: find "N. " markers only when N continues the sequence 1, 2, 3 … */
function splitProse(text: string): PracticeQuestion[] {
  const re = /(?:^|\s)(\d{1,2})\.\s+/g;
  const starts: { n: number; from: number; to: number }[] = [];
  let expected = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n !== expected) {
      // A run restarting at 1 after questions have started is the answer key.
      if (n === 1 && starts.length) expected = 1;
      else continue;
    }
    starts.push({ n, from: m.index + m[0].indexOf(m[1]), to: m.index + m[0].length });
    expected++;
  }
  if (!starts.length) return [];
  const vignette = text.slice(0, starts[0].from).trim();
  return starts.map((s, i) => {
    const body = text.slice(s.to, i + 1 < starts.length ? starts[i + 1].from : undefined);
    const item: PracticeQuestion = { n: s.n, ...splitChoicesProse(body) };
    if (i === 0 && vignette) item.vignette = vignette;
    return item;
  });
}

/** Choices ascend A, B, C …; a letter only counts when it continues that sequence. */
function splitChoicesProse(body: string): { stem: string; choices: { label: string; text: string }[] } {
  const re = /(?:^|\s)([A-F])\.\s+/g;
  const starts: { label: string; from: number; to: number }[] = [];
  let expected = 65; // "A"
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1].charCodeAt(0) !== expected) continue;
    starts.push({ label: m[1], from: m.index + m[0].indexOf(m[1]), to: m.index + m[0].length });
    expected++;
  }
  if (!starts.length) return { stem: body.trim(), choices: [] };
  const stem = body.slice(0, starts[0].from).trim();
  const choices = starts.map((s, i) => ({
    label: s.label,
    text: body.slice(s.to, i + 1 < starts.length ? starts[i + 1].from : undefined).trim(),
  })).filter((c) => c.text);
  return { stem, choices };
}
