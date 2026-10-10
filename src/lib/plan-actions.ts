import { supabase } from "@/integrations/supabase/client";
import { generatePlan, type PlanModule, type PlanTask } from "./planner";
import { isoDate, ETHICS_ID } from "./cfa";

export const PLAN_HORIZON_DAYS = 28;

type Cur = { subjects: { id: string; est_hours: number }[]; modules: { id: string; subject_id: string; title: string }[] };
type Prog = { modules: { module_id: string; status: string }[]; plans: { subject_id: string; status: string; position: number | null }[] };

export function moduleMinutes(cur: Cur, subjectId: string) {
  const s = cur.subjects.find((x) => x.id === subjectId);
  const n = cur.modules.filter((m) => m.subject_id === subjectId).length || 1;
  return Math.round(((s?.est_hours ?? 20) * 60) / n);
}

export function pendingQueues(cur: Cur, prog: Prog) {
  const done = new Set(prog.modules.filter((m) => m.status === "completed").map((m) => m.module_id));
  const toPM = (sid: string): PlanModule[] =>
    cur.modules.filter((m) => m.subject_id === sid && !done.has(m.id)).map((m) => ({ id: m.id, subject_id: sid, title: m.title, minutes: moduleMinutes(cur, sid) }));
  const active = [...prog.plans].filter((p) => p.status === "active" && p.subject_id !== ETHICS_ID).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const primaryQueue = active.flatMap((p) => toPM(p.subject_id));
  const ethicsPlan = prog.plans.find((p) => p.subject_id === ETHICS_ID);
  const ethicsQueue = ethicsPlan?.status === "completed" ? [] : toPM(ETHICS_ID);
  const remainingMinutes = cur.subjects.reduce((a, s) => a + toPM(s.id).reduce((b, m) => b + m.minutes, 0), 0);
  return { primaryQueue, ethicsQueue, remainingMinutes };
}

export function proposePlan(opts: { cur: Cur; prog: Prog; studyDays: number[]; hoursPerDay: number; examDate: string | null }): PlanTask[] {
  const q = pendingQueues(opts.cur, opts.prog);
  return generatePlan({
    startDate: isoDate(),
    days: PLAN_HORIZON_DAYS,
    studyDays: opts.studyDays,
    minutesPerDay: Math.round(opts.hoursPerDay * 60),
    primaryQueue: q.primaryQueue,
    ethicsQueue: q.ethicsQueue,
    examDate: opts.examDate,
  });
}

/** Replaces only future, not-yet-done tasks. Completed and past tasks are kept. */
export async function applyPlan(userId: string, attemptId: string, tasks: PlanTask[]) {
  const today = isoDate();
  const del = await supabase.from("study_tasks").delete().eq("attempt_id", attemptId).eq("done", false).gte("task_date", today);
  if (del.error) throw del.error;
  if (!tasks.length) return;
  const ins = await supabase.from("study_tasks").insert(tasks.map((t) => ({ ...t, user_id: userId, attempt_id: attemptId })));
  if (ins.error) throw ins.error;
}
