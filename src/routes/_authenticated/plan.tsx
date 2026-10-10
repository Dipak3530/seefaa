import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Pause, Play, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Empty } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate, useProfile, useProgress } from "@/hooks/use-seefaa";
import { addDays, fmtDate, isoDate, ETHICS_ID } from "@/lib/cfa";
import { applyPlan, pendingQueues, proposePlan } from "@/lib/plan-actions";
import { feasibility, type PlanTask } from "@/lib/planner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "My Study Plan — SEEFAA" }, { name: "description", content: "Your adaptive CFA Level I study plan." }] }),
  component: PlanPage,
});

const STATUS_LABEL: Record<string, string> = { not_started: "Not started", active: "Studying", paused: "Paused", completed: "Completed" };

function PlanPage() {
  const { data: profile } = useProfile();
  const { data: attempt } = useAttempt();
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const inv = useInvalidate();
  const today = isoDate();
  const [proposal, setProposal] = useState<PlanTask[] | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["plan-tasks", attempt?.id],
    enabled: !!attempt,
    queryFn: async () => (await supabase.from("study_tasks").select("*").eq("attempt_id", attempt!.id).gte("task_date", addDays(today, -14)).order("task_date").order("kind")).data ?? [],
  });

  if (!cur || !prog || !attempt || !profile) return <p className="text-muted-foreground">Loading…</p>;
  const plans = [...prog.plans].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const q = pendingQueues(cur, prog);
  const feas = feasibility({ remainingMinutes: q.remainingMinutes, startDate: today, targetDate: attempt.target_completion_date, studyDays: profile.study_days, minutesPerDay: Number(profile.hours_per_day) * 60 });

  async function updatePlan(id: string, patch: Record<string, any>) {
    const { error } = await supabase.from("subject_plans").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    inv("progress");
  }
  async function move(idx: number, dir: -1 | 1) {
    const a = plans[idx], b = plans[idx + dir];
    if (!a || !b) return;
    await Promise.all([updatePlan(a.id, { position: b.position }), updatePlan(b.id, { position: a.position })]);
  }
  function propose() {
    setProposal(proposePlan({ cur: cur!, prog: prog!, studyDays: profile!.study_days, hoursPerDay: Number(profile!.hours_per_day), examDate: attempt!.exam_date }));
  }
  async function accept() {
    try {
      await applyPlan(profile!.id, attempt!.id, proposal!);
      toast.success("Plan updated. Completed tasks were kept.");
      setProposal(null);
      inv("plan-tasks", "dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function toggle(id: string, done: boolean) {
    await supabase.from("study_tasks").update({ done, completed_at: done ? new Date().toISOString() : null }).eq("id", id);
    inv("plan-tasks", "dashboard");
  }

  const future = (tasks ?? []).filter((t) => !t.done && t.task_date >= today);
  const byDate = new Map<string, NonNullable<typeof tasks>>();
  (tasks ?? []).forEach((t) => byDate.set(t.task_date, [...(byDate.get(t.task_date) ?? []), t]));
  const overdue = (tasks ?? []).filter((t) => !t.done && t.task_date < today);

  return (
    <div className="space-y-6">
      <PageHeader title="My Study Plan" subtitle="Choose subjects one at a time. Ethics always runs alongside." actions={<Button onClick={propose}><Wand2 className="mr-2 h-4 w-4" /> Recalculate plan</Button>} />
      {feas && !feas.realistic && (
        <div className="rounded-xl border border-sun bg-sun/25 p-4 text-sm">
          <b>Your target date looks tight.</b> You need about {Math.round(feas.needed / 60)}h of study but have ~{Math.round(feas.available / 60)}h before {fmtDate(attempt.target_completion_date)}.
          Options: increase daily hours or study days in Settings, move the target date, or focus on fewer subjects first.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Subject sequence" className="lg:col-span-2">
          <ul className="space-y-2">
            {plans.map((p, i) => {
              const s = cur.subject(p.subject_id);
              const mods = cur.modulesOf(p.subject_id);
              const done = prog.modules.filter((m) => m.status === "completed" && mods.some((x) => x.id === m.module_id)).length;
              return (
                <li key={p.id} className={cn("rounded-lg border p-3", p.status === "active" && "border-primary bg-accent/50")}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s?.name}{p.subject_id === ETHICS_ID && <span className="ml-2 rounded bg-sun/40 px-1.5 text-[10px]">always on</span>}</p>
                      <p className="text-xs text-muted-foreground">{STATUS_LABEL[p.status]} · {done}/{mods.length} modules{p.deadline ? ` · due ${fmtDate(p.deadline)}` : ""}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.status !== "active" && p.status !== "completed" && <Button size="sm" variant="secondary" className="h-7" onClick={() => updatePlan(p.id, { status: "active" })}><Play className="mr-1 h-3 w-3" />Start</Button>}
                    {p.status === "active" && p.subject_id !== ETHICS_ID && <Button size="sm" variant="secondary" className="h-7" onClick={() => updatePlan(p.id, { status: "paused" })}><Pause className="mr-1 h-3 w-3" />Pause</Button>}
                    {p.status !== "completed" && <Button size="sm" variant="ghost" className="h-7" onClick={() => updatePlan(p.id, { status: "completed" })}>Mark studied</Button>}
                    {p.status === "completed" && <Button size="sm" variant="ghost" className="h-7" onClick={() => updatePlan(p.id, { status: "active" })}>Reopen</Button>}
                    <Input type="date" className="h-7 w-36 text-xs" value={p.deadline ?? ""} onChange={(e) => updatePlan(p.id, { deadline: e.target.value || null })} aria-label="Personal deadline" />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">After changing subjects, press <b>Recalculate plan</b> to update future tasks.</p>
        </Panel>
        <Panel title="Schedule" className="lg:col-span-3">
          {overdue.length > 0 && <p className="mb-3 rounded-md bg-sun/25 px-3 py-2 text-xs">{overdue.length} catch-up task(s) from earlier days are still open below.</p>}
          {!tasks?.length ? <Empty title="No tasks yet" body="Press Recalculate plan to generate your schedule." /> : (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {[...byDate.entries()].map(([date, list]) => (
                <div key={date}>
                  <p className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", date === today ? "text-primary" : "text-muted-foreground")}>{date === today ? "Today · " : ""}{fmtDate(date)}</p>
                  <ul className="space-y-1">
                    {list.map((t) => (
                      <li key={t.id}>
                        <button onClick={() => toggle(t.id, !t.done)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                          {t.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className={cn("h-4 w-4", t.task_date < today ? "text-destructive" : "text-muted-foreground")} />}
                          <span className={cn("flex-1", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                          <span className="text-xs text-muted-foreground">{t.kind} · {t.minutes}m</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={!!proposal} onOpenChange={(o) => !o && setProposal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Review plan changes</DialogTitle></DialogHeader>
          {proposal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Current upcoming tasks</p><p className="text-xl font-semibold">{future.length}</p><p className="text-xs">{Math.round(future.reduce((a, t) => a + t.minutes, 0) / 60)}h</p></div>
                <div className="rounded-lg bg-accent p-3"><p className="text-xs text-muted-foreground">Proposed (next 4 weeks)</p><p className="text-xl font-semibold">{proposal.length}</p><p className="text-xs">{Math.round(proposal.reduce((a, t) => a + t.minutes, 0) / 60)}h · {proposal.filter((t) => t.kind === "ethics").length} Ethics sessions</p></div>
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                {proposal.slice(0, 40).map((t, i) => <li key={i}><span className="text-muted-foreground">{fmtDate(t.task_date)}</span> — {t.title} ({t.minutes}m)</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">Completed tasks and earlier catch-up tasks stay untouched.</p>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setProposal(null)}>Keep current plan</Button><Button onClick={accept}>Accept changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
