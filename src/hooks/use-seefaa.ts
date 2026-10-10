import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Subject = Tables<"subjects">;
export type Module = Tables<"modules">;
export type Profile = Tables<"profiles">;
export type Attempt = Tables<"exam_attempts">;

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAttempt() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["attempt", profile?.active_attempt_id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile?.active_attempt_id) return null;
      const { data } = await supabase.from("exam_attempts").select("*").eq("id", profile.active_attempt_id).maybeSingle();
      return data;
    },
  });
}

export function useCurriculum() {
  return useQuery({
    queryKey: ["curriculum"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [s, m, l] = await Promise.all([
        supabase.from("subjects").select("*").order("sort"),
        supabase.from("modules").select("*").order("sort"),
        supabase.from("los").select("*").order("sort"),
      ]);
      if (s.error) throw s.error;
      if (m.error) throw m.error;
      const subjects = s.data ?? [];
      const modules = m.data ?? [];
      return {
        subjects,
        modules,
        los: l.data ?? [],
        subject: (id?: string | null) => subjects.find((x) => x.id === id),
        module: (id?: string | null) => modules.find((x) => x.id === id),
        modulesOf: (sid?: string | null) => modules.filter((x) => x.subject_id === sid),
      };
    },
  });
}

/** Module progress + subject plans for the active attempt. */
export function useProgress() {
  const { data: attempt } = useAttempt();
  return useQuery({
    queryKey: ["progress", attempt?.id],
    enabled: !!attempt,
    queryFn: async () => {
      const [mp, sp, lp] = await Promise.all([
        supabase.from("module_progress").select("*").eq("attempt_id", attempt!.id),
        supabase.from("subject_plans").select("*").eq("attempt_id", attempt!.id).order("position"),
        supabase.from("los_progress").select("*").eq("attempt_id", attempt!.id),
      ]);
      return { modules: mp.data ?? [], plans: sp.data ?? [], los: lp.data ?? [] };
    },
  });
}

export function useXp() {
  return useQuery({
    queryKey: ["xp"],
    queryFn: async () => {
      const { data } = await supabase.from("xp_ledger").select("*").order("created_at", { ascending: false });
      const rows = data ?? [];
      return { rows, total: rows.reduce((a, r) => a + r.amount, 0) };
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
