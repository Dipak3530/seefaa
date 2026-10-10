export const ERROR_CATEGORIES = [
  { id: "conceptual", label: "Conceptual misunderstanding" },
  { id: "formula_forgotten", label: "Formula forgotten" },
  { id: "formula_misapplied", label: "Formula applied incorrectly" },
  { id: "calculator", label: "Calculator or keystroke error" },
  { id: "misread", label: "Misread question" },
  { id: "interpretation", label: "Incorrect interpretation" },
  { id: "arithmetic", label: "Careless arithmetic" },
  { id: "similar_concepts", label: "Confusion between similar concepts" },
  { id: "guessed", label: "Guessed correctly" },
  { id: "other", label: "Other" },
] as const;
export const categoryLabel = (id?: string | null) =>
  ERROR_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";

export const CONFIDENCE = ["low", "medium", "high"] as const;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const ETHICS_ID = "ethics";

/** Local yyyy-mm-dd for a Date (uses the browser's time zone). */
export function isoDate(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
}
export function fmtDate(s?: string | null) {
  if (!s) return "—";
  return parseDate(s.slice(0, 10)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
export function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}
export function fmtHours(seconds: number) {
  const h = seconds / 3600;
  return h < 1 ? `${Math.round(seconds / 60)}m` : `${h.toFixed(1)}h`;
}

/** Active seconds of a timer session at time `now`, excluding paused time. */
export function activeSeconds(
  s: { started_at: string; status: string; paused_at: string | null; paused_seconds: number; ended_at: string | null; active_seconds: number | null },
  now: number = Date.now(),
) {
  if (s.status === "finished" && s.active_seconds != null) return s.active_seconds;
  const start = new Date(s.started_at).getTime();
  const end = s.status === "paused" && s.paused_at ? new Date(s.paused_at).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 1000) - s.paused_seconds);
}

export function studyPhase(daysToExam: number | null, completionPct: number) {
  if (daysToExam == null) return "Learning";
  if (daysToExam <= 0) return "Exam day reached";
  if (daysToExam <= 21) return "Final revision & mocks";
  if (completionPct >= 100) return "Revision";
  return "Learning";
}
