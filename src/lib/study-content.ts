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

/** Sections that teach a given LOS number; untagged sections (overview, practice) appear only under "All". */
export function sectionsForLos(sections: ContentSection[], los: number | null) {
  if (los == null) return sections;
  return sections.filter((s) => s.los.includes(los));
}
