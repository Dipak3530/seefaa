import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Lesson text extracted from the candidate's uploaded 2027 curriculum PDFs, stored privately per subject. */
export type ContentBlock = { t: "p" | "h" | "table"; x: string };
export type ContentSection = { title: string; los: number[]; blocks: ContentBlock[] };
export type ModuleContent = { num: number; los: string[]; sections: ContentSection[] };

export function moduleNumber(moduleId: string) {
  const m = moduleId.match(/-m(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function useSubjectContent(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["study-content", subjectId],
    enabled: !!subjectId,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("curriculum-content").download(`2027/${subjectId}.json`);
      if (error) throw error;
      return JSON.parse(await data.text()) as ModuleContent[];
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

export type PracticeQuestion = { n: number; stem: string; choices: { label: string; text: string }[]; vignette?: string };

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
  let text = blocks.map((b) => b.x).join(" ").replace(/­/g, "").trim();
  for (const n of noise) if (n) text = text.split(n).join(" ");
  const tabbed = splitNumbered(text, /(\d{1,2})\.\t/, /([A-F])\.\t/);
  if (tabbed.length >= 2) return tabbed;
  return splitProse(text);
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
  const stem = segs[0].replace(/\s+/g, " ").trim();
  const choices: { label: string; text: string }[] = [];
  for (let j = 1; j + 1 < segs.length; j += 2) {
    const ct = segs[j + 1].replace(/\s+/g, " ").trim();
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
    if (n !== expected) continue;
    starts.push({ n, from: m.index + m[0].indexOf(m[1]), to: m.index + m[0].length });
    expected++;
  }
  if (!starts.length) return [];
  const vignette = text.slice(0, starts[0].from).replace(/\s+/g, " ").trim();
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
  if (!starts.length) return { stem: body.replace(/\s+/g, " ").trim(), choices: [] };
  const stem = body.slice(0, starts[0].from).replace(/\s+/g, " ").trim();
  const choices = starts.map((s, i) => ({
    label: s.label,
    text: body.slice(s.to, i + 1 < starts.length ? starts[i + 1].from : undefined).replace(/\s+/g, " ").trim(),
  })).filter((c) => c.text);
  return { stem, choices };
}
