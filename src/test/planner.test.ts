import { describe, it, expect } from "vitest";
import { generatePlan, feasibility } from "@/lib/planner";
import { activeSeconds } from "@/lib/cfa";

const fi = [{ id: "fi-m01", subject_id: "fi", title: "FI 1", minutes: 120 }];
const eth = [{ id: "ethics-m01", subject_id: "ethics", title: "Eth 1", minutes: 90 }];

describe("planner", () => {
  it("includes Ethics on the very first study day alongside the chosen subject", () => {
    const t = generatePlan({ startDate: "2026-10-12", days: 7, studyDays: [1, 2, 3, 4, 5], minutesPerDay: 120, primaryQueue: fi, ethicsQueue: eth });
    const day1 = t.filter((x) => x.task_date === "2026-10-12");
    expect(day1.some((x) => x.kind === "ethics")).toBe(true);
    expect(day1.some((x) => x.subject_id === "fi")).toBe(true);
  });
  it("schedules nothing on break days", () => {
    const t = generatePlan({ startDate: "2026-10-11", days: 1, studyDays: [1, 2, 3, 4, 5], minutesPerDay: 120, primaryQueue: fi, ethicsQueue: eth });
    expect(t).toHaveLength(0); // 2026-10-11 is a Sunday
  });
  it("keeps Ethics practice when Ethics is already complete", () => {
    const t = generatePlan({ startDate: "2026-10-12", days: 1, studyDays: [1], minutesPerDay: 120, primaryQueue: fi, ethicsQueue: [] });
    expect(t[0].kind).toBe("ethics");
  });
  it("flags an unrealistic target", () => {
    const f = feasibility({ remainingMinutes: 6000, startDate: "2026-10-12", targetDate: "2026-10-18", studyDays: [1, 2, 3, 4, 5], minutesPerDay: 120 });
    expect(f?.realistic).toBe(false);
  });
});

describe("timer", () => {
  it("excludes paused time", () => {
    const start = new Date("2026-10-10T10:00:00Z").toISOString();
    const s = { started_at: start, status: "running", paused_at: null, paused_seconds: 600, ended_at: null, active_seconds: null };
    expect(activeSeconds(s, new Date("2026-10-10T11:00:00Z").getTime())).toBe(3000);
  });
});
