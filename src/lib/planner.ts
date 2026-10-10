import { addDays, daysBetween, parseDate, ETHICS_ID } from "./cfa";

export type PlanModule = { id: string; subject_id: string; title: string; minutes: number };
export type PlanTask = {
  task_date: string;
  kind: "study" | "ethics" | "practice" | "revision" | "mock";
  subject_id: string | null;
  module_id: string | null;
  title: string;
  minutes: number;
};
export type PlanInput = {
  startDate: string;
  days: number;
  studyDays: number[]; // 0=Sun..6=Sat
  minutesPerDay: number;
  /** Pending modules of active subjects in the order the candidate chose (Ethics excluded). */
  primaryQueue: PlanModule[];
  /** Pending Ethics modules; empty when Ethics is complete. */
  ethicsQueue: PlanModule[];
  examDate?: string | null;
};

const ETHICS_MIN = 30;

/** Generates daily tasks. Ethics appears on every study day from day one. */
export function generatePlan(input: PlanInput): PlanTask[] {
  const tasks: PlanTask[] = [];
  const primary = input.primaryQueue.map((m) => ({ ...m, left: m.minutes, part: 1 }));
  const ethics = input.ethicsQueue.map((m) => ({ ...m, left: m.minutes, part: 1 }));
  let studyDayIndex = 0;
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.startDate, i);
    if (!input.studyDays.includes(parseDate(date).getDay())) continue;
    studyDayIndex++;
    const toExam = input.examDate ? daysBetween(date, input.examDate) : null;
    if (toExam != null && toExam < 0) break;
    let budget = input.minutesPerDay;

    if (toExam != null && toExam <= 21) {
      if (toExam % 7 === 0 && toExam > 0) {
        tasks.push({ task_date: date, kind: "mock", subject_id: null, module_id: null, title: "Full mock exam", minutes: Math.max(budget, 180) });
        continue;
      }
      tasks.push({ task_date: date, kind: "revision", subject_id: null, module_id: null, title: "Final revision: weak areas & due reviews", minutes: budget });
      continue;
    }

    // Ethics from day one
    const e = ethics[0];
    const eMin = Math.min(ETHICS_MIN, budget);
    if (e) {
      const used = Math.min(eMin, e.left);
      tasks.push({ task_date: date, kind: "ethics", subject_id: ETHICS_ID, module_id: e.id, title: `Ethics: ${e.title}${e.minutes > used || e.part > 1 ? ` (part ${e.part})` : ""}`, minutes: used });
      e.left -= used;
      e.part++;
      if (e.left <= 0) ethics.shift();
      budget -= used;
    } else if (studyDayIndex % 3 === 1) {
      tasks.push({ task_date: date, kind: "ethics", subject_id: ETHICS_ID, module_id: null, title: "Ethics practice & revision", minutes: eMin });
      budget -= eMin;
    }

    if (studyDayIndex % 6 === 0 && budget >= 30) {
      tasks.push({ task_date: date, kind: "practice", subject_id: primary[0]?.subject_id ?? null, module_id: null, title: "Practice questions on recent modules", minutes: Math.min(45, budget) });
      budget -= Math.min(45, budget);
    }

    while (budget >= 15 && primary.length) {
      const m = primary[0];
      const used = Math.min(budget, m.left);
      tasks.push({ task_date: date, kind: "study", subject_id: m.subject_id, module_id: m.id, title: `${m.title}${m.minutes > used || m.part > 1 ? ` (part ${m.part})` : ""}`, minutes: used });
      m.left -= used;
      m.part++;
      budget -= used;
      if (m.left <= 0) primary.shift();
    }
  }
  return tasks;
}

/** Hours needed vs available until target date. */
export function feasibility(opts: { remainingMinutes: number; startDate: string; targetDate: string | null; studyDays: number[]; minutesPerDay: number }) {
  if (!opts.targetDate) return null;
  const span = daysBetween(opts.startDate, opts.targetDate);
  let studyDays = 0;
  for (let i = 0; i <= span; i++) if (opts.studyDays.includes(parseDate(addDays(opts.startDate, i)).getDay())) studyDays++;
  const available = studyDays * opts.minutesPerDay;
  return { available, needed: opts.remainingMinutes, realistic: available >= opts.remainingMinutes, studyDays };
}
