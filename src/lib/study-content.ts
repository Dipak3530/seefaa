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

export type PracticeQuestion = { n: number; stem: string; choices: { label: string; text: string }[] };

/**
 * Split a run-on "Practice Problems" / "Solutions" extraction into numbered items.
 * The PDF text arrives as one paragraph: "1.\t stem A.\t x. B.\t y. C.\t z. 2.\t …",
 * with page headers (module title, "Practice Problems") embedded mid-sentence.
 * Presentation only — never invents or alters content.
 */
export function parsePracticeItems(blocks: ContentBlock[], noise: string[] = []): PracticeQuestion[] {
  let text = blocks.map((b) => b.x).join(" ").replace(/­/g, "").replace(/\s+/g, " ").trim();
  for (const n of noise) if (n) text = text.split(n).join(" ");
  const parts = text.split(/(?<!\d)(\d{1,2})\.\t|(?<!\d)(\d{1,2})\.\s(?=[A-Z])/);
  const items: PracticeQuestion[] = [];
  for (let i = 1; i < parts.length; i += 3) {
    const n = Number(parts[i] ?? parts[i + 1]);
    const body = (parts[i + 2] ?? "").trim();
    if (!n || !body) continue;
    const segs = body.split(/([A-F])\.\t|([A-F])\.\s(?=[A-Z0-9−-])/);
    const stem = segs[0].trim();
    const choices: { label: string; text: string }[] = [];
    for (let j = 1; j + 1 < segs.length; j += 3) {
      const label = segs[j] ?? segs[j + 1];
      const ct = (segs[j + 2] ?? "").trim();
      if (label && ct) choices.push({ label, text: ct });
    }
    items.push({ n, stem, choices });
  }
  return items;
}
