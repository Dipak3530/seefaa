import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Stat, Bar, Empty } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useProgress } from "@/hooks/use-seefaa";
import { activeSeconds, addDays, categoryLabel, fmtHours, isoDate } from "@/lib/cfa";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — SEEFAA" }, { name: "description", content: "Progress, accuracy, time and mistake analytics from your real data." }] }),
  component: Analytics,
});

const MIN_SAMPLE = 10;

function Analytics() {
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const { data: attempt } = useAttempt();
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const { data, refetch } = useQuery({
    queryKey: ["analytics", attempt?.id],
    enabled: !!attempt,
    queryFn: async () => {
      const [t, p, m, cp, mk, tasks] = await Promise.all([
        supabase.from("timer_sessions").select("*").eq("status", "finished").order("started_at", { ascending: false }),
        supabase.from("practice_sessions").select("*").order("session_date"),
        supabase.from("mistakes").select("id, subject_id, module_id, concept, error_category, mastery, attempts_count, correct_count"),
        supabase.from("revision_checkpoints").select("due_date, completed_at").eq("attempt_id", attempt!.id),
        supabase.from("mock_exams").select("name, exam_date, score_pct").order("exam_date"),
        supabase.from("study_tasks").select("task_date, minutes, kind").eq("attempt_id", attempt!.id),
      ]);
      return { timers: t.data ?? [], practice: p.data ?? [], mistakes: m.data ?? [], cps: cp.data ?? [], mocks: mk.data ?? [], tasks: tasks.data ?? [] };
    },
  });
  if (!cur || !prog || !data) return <p className="text-muted-foreground">Loading…</p>;
  const today = isoDate();
  const done = prog.modules.filter((x) => x.status === "completed").length;

  // Time buckets
  const bucketKey = (d: string) => {
    if (range === "day") return d;
    if (range === "month") return d.slice(0, 7);
    const dt = new Date(d); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return isoDate(dt);
  };
  const buckets = new Map<string, { k: string; study: number; revision: number; planned: number }>();
  const nBuckets = range === "day" ? 14 : range === "week" ? 8 : 6;
  for (let i = nBuckets - 1; i >= 0; i--) {
    const d = range === "day" ? addDays(today, -i) : range === "week" ? addDays(today, -7 * i) : isoDate(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1));
    const k = bucketKey(d); buckets.set(k, { k, study: 0, revision: 0, planned: 0 });
  }
  data.timers.forEach((t) => { const b = buckets.get(bucketKey(isoDate(new Date(t.started_at)))); if (b) b[t.kind as "study" | "revision"] += activeSeconds(t) / 3600; });
  data.tasks.forEach((t) => { const b = buckets.get(bucketKey(t.task_date)); if (b) b.planned += t.minutes / 60; });
  const timeData = [...buckets.values()].map((b) => ({ ...b, study: +b.study.toFixed(2), revision: +b.revision.toFixed(2), planned: +b.planned.toFixed(1) }));
  const totalStudy = data.timers.filter((t) => t.kind === "study").reduce((a, t) => a + activeSeconds(t), 0);
  const totalRev = data.timers.filter((t) => t.kind === "revision").reduce((a, t) => a + activeSeconds(t), 0);

  const bySubjectTime = cur.subjects.map((s) => ({ name: s.short_name, hours: +(data.timers.filter((t) => t.subject_id === s.id).reduce((a, t) => a + activeSeconds(t), 0) / 3600).toFixed(1) })).filter((x) => x.hours > 0);
  const accBySubject = cur.subjects.map((s) => {
    const ps = data.practice.filter((p) => p.subject_id === s.id);
    const tot = ps.reduce((a, p) => a + p.total, 0);
    return { name: s.short_name, accuracy: tot ? Math.round((ps.reduce((a, p) => a + p.correct, 0) / tot) * 100) : null, n: tot };
  }).filter((x) => x.n > 0);
  const accTrend = data.practice.map((p) => ({ date: p.session_date, accuracy: Math.round((p.correct / p.total) * 100) }));
  const cats = Object.entries(data.mistakes.reduce<Record<string, number>>((a, m) => { a[m.error_category] = (a[m.error_category] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const concepts = Object.entries(data.mistakes.reduce<Record<string, number>>((a, m) => { const k = m.concept?.trim() || cur.module(m.module_id)?.title || "Unlabelled"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const resolved = data.mistakes.filter((m) => m.mastery === "mastered").length;
  const dueCps = data.cps.filter((c) => c.due_date <= today);
  const revRate = dueCps.length ? Math.round((dueCps.filter((c) => c.completed_at).length / dueCps.length) * 100) : null;
  const overdue = data.cps.filter((c) => !c.completed_at && c.due_date < today).length;

  async function editSession(id: string, minutes: string) {
    const m = Number(minutes);
    if (isNaN(m) || m < 0) return;
    await supabase.from("timer_sessions").update({ active_seconds: Math.round(m * 60) }).eq("id", id);
    toast.success("Session corrected"); refetch();
  }
  async function delSession(id: string) {
    if (!confirm("Delete this study session? Totals will be recalculated.")) return;
    await supabase.from("timer_sessions").delete().eq("id", id); refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Calculated only from what you've recorded. Small samples are labelled — don't read too much into them." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="deep" label="Syllabus" value={`${Math.round((done / cur.modules.length) * 100)}%`} hint={`${done}/${cur.modules.length} modules · ${prog.los.filter((l) => l.status === "completed").length} LOS`} />
        <Stat label="Study / revision time" value={`${fmtHours(totalStudy)} / ${fmtHours(totalRev)}`} hint={`Combined ${fmtHours(totalStudy + totalRev)}`} />
        <Stat label="Error-resolution rate" value={data.mistakes.length ? `${Math.round((resolved / data.mistakes.length) * 100)}%` : "—"} hint={`${resolved} of ${data.mistakes.length} mistakes mastered`} />
        <Stat tone="sun" label="Revision completion" value={revRate == null ? "—" : `${revRate}%`} hint={`${overdue} overdue checkpoint(s)`} />
      </div>

      <Panel title="Study vs revision hours, with planned time" action={
        <div className="flex gap-1">{(["day", "week", "month"] as const).map((r) => <Button key={r} size="sm" variant={range === r ? "default" : "ghost"} onClick={() => setRange(r)}>{r === "day" ? "Daily" : r === "week" ? "Weekly" : "Monthly"}</Button>)}</div>}>
        <div className="h-64"><ResponsiveContainer><BarChart data={timeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="k" fontSize={11} /><YAxis fontSize={11} unit="h" /><Tooltip /><Legend />
          <RBar dataKey="study" name="Study" stackId="a" fill="var(--color-primary)" /><RBar dataKey="revision" name="Revision" stackId="a" fill="var(--color-sun)" />
          <RBar dataKey="planned" name="Planned" fill="var(--color-chart-4)" />
        </BarChart></ResponsiveContainer></div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Subject completion">
          <div className="space-y-3">{cur.subjects.map((s) => {
            const mods = cur.modulesOf(s.id); const d = prog.modules.filter((m) => m.status === "completed" && mods.some((x) => x.id === m.module_id)).length;
            return <div key={s.id}><div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="text-muted-foreground">{Math.round((d / mods.length) * 100)}%</span></div><Bar value={(d / mods.length) * 100} /></div>;
          })}</div>
        </Panel>
        <Panel title="Practice accuracy by subject">
          {!accBySubject.length ? <Empty title="No practice recorded yet" /> : (
            <ul className="space-y-2 text-sm">{accBySubject.map((a) => <li key={a.name} className="flex items-center justify-between"><span>{a.name}</span><span><b>{a.accuracy}%</b> <span className="text-xs text-muted-foreground">({a.n} Qs{a.n < MIN_SAMPLE ? " · small sample" : ""})</span></span></li>)}</ul>
          )}
          {accTrend.length >= 2 && <div className="mt-4 h-40"><ResponsiveContainer><LineChart data={accTrend}><XAxis dataKey="date" fontSize={10} /><YAxis domain={[0, 100]} fontSize={10} /><Tooltip /><Line dataKey="accuracy" stroke="var(--color-deep)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>}
        </Panel>
        <Panel title="Recurring error types">
          {!cats.length ? <Empty title="No mistakes logged yet" /> : <ul className="space-y-2 text-sm">{cats.map(([k, n]) => <li key={k}><div className="mb-1 flex justify-between"><span>{categoryLabel(k)}</span><span>{n}</span></div><Bar value={(n / data.mistakes.length) * 100} /></li>)}</ul>}
        </Panel>
        <Panel title="Most frequently missed concepts">
          {!concepts.length ? <Empty title="Nothing yet" /> : <ol className="list-decimal space-y-1 pl-5 text-sm">{concepts.map(([k, n]) => <li key={k}>{k} <span className="text-muted-foreground">× {n}</span></li>)}</ol>}
        </Panel>
        <Panel title="Time by subject">
          {!bySubjectTime.length ? <Empty title="Use the timer with a subject selected to see this" /> : <div className="h-52"><ResponsiveContainer><BarChart data={bySubjectTime} layout="vertical"><XAxis type="number" fontSize={11} unit="h" /><YAxis type="category" dataKey="name" fontSize={11} width={80} /><Tooltip /><RBar dataKey="hours" fill="var(--color-primary)" radius={4} /></BarChart></ResponsiveContainer></div>}
        </Panel>
        <Panel title="Mock score history">
          {!data.mocks.length ? <Empty title="No mocks yet" /> : <div className="h-52"><ResponsiveContainer><LineChart data={data.mocks.map((m) => ({ name: m.name, score: Number(m.score_pct) }))}><XAxis dataKey="name" fontSize={10} /><YAxis domain={[0, 100]} fontSize={10} /><Tooltip /><Line dataKey="score" stroke="var(--color-primary)" strokeWidth={2.5} /></LineChart></ResponsiveContainer></div>}
        </Panel>
      </div>

      <Panel title="Past timer sessions">
        {!data.timers.length ? <Empty title="No sessions yet" body="Start Studying or Start Revision from the dashboard." /> : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">When</th><th>Type</th><th>Subject / module</th><th>Minutes</th><th /></tr></thead>
              <tbody>{data.timers.slice(0, 100).map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-1.5">{new Date(t.started_at).toLocaleString()}</td>
                  <td>{t.kind === "study" ? "Study" : "Revision"}</td>
                  <td>{cur.subject(t.subject_id)?.short_name ?? "—"}{t.module_id ? ` · ${cur.module(t.module_id)?.title}` : ""}</td>
                  <td><Input className="h-7 w-20" type="number" defaultValue={Math.round(activeSeconds(t) / 60)} onBlur={(e) => Number(e.target.value) !== Math.round(activeSeconds(t) / 60) && editSession(t.id, e.target.value)} aria-label="Minutes" /></td>
                  <td><Button size="icon" variant="ghost" onClick={() => delSession(t.id)} aria-label="Delete session"><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
