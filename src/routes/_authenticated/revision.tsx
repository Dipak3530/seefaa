import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Empty, NativeSelect } from "@/components/seefaa/bits";
import { QuizRunner } from "@/components/seefaa/quiz";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { addDays, fmtDate, isoDate } from "@/lib/cfa";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/revision")({
  head: () => ({ meta: pageMeta("Revision Centre — SEEFAA", "Today's due and overdue reviews.") }),
  component: Revision,
});

const MODES = ["Formula recall", "Personal notes", "Practice questions", "Explain from memory", "Reattempt saved mistakes"];

function Revision() {
  const { data: attempt } = useAttempt();
  const { data: cur } = useCurriculum();
  const inv = useInvalidate();
  const today = isoDate();
  const [quiz, setQuiz] = useState(false);
  const [doing, setDoing] = useState<Tables<"revision_checkpoints"> | null>(null);
  const [perf, setPerf] = useState("80");
  const [conf, setConf] = useState("medium");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const { data, refetch } = useQuery({
    queryKey: ["revision", attempt?.id, today],
    enabled: !!attempt,
    queryFn: async () => {
      const [cps, ms] = await Promise.all([
        supabase.from("revision_checkpoints").select("*").eq("attempt_id", attempt!.id).is("completed_at", null).lte("due_date", addDays(today, 7)).order("due_date"),
        supabase.from("mistakes").select("*").neq("mastery", "mastered").lte("next_review", today).order("next_review"),
      ]);
      return { cps: cps.data ?? [], mistakes: ms.data ?? [] };
    },
  });
  if (!cur || !data) return <p className="text-muted-foreground">Loading…</p>;
  const overdue = data.cps.filter((c) => c.due_date < today);
  const due = data.cps.filter((c) => c.due_date === today);
  const upcoming = data.cps.filter((c) => c.due_date > today);
  const weak = Object.entries(data.mistakes.reduce<Record<string, number>>((a, m) => { const k = m.module_id ?? m.subject_id ?? "?"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  async function complete() {
    const { error } = await supabase.from("revision_checkpoints").update({ completed_at: new Date().toISOString(), performance: Number(perf), confidence: conf, notes: `[${mode}] ${notes}`.trim() }).eq("id", doing!.id);
    if (error) return toast.error(error.message);
    toast.success(Number(perf) < 60 ? "Logged. Your next checkpoints were brought forward." : "Checkpoint complete · +5 XP");
    setDoing(null); setNotes(""); refetch(); inv("xp", "dashboard", "progress");
  }
  async function reschedule(id: string, days: number) {
    await supabase.from("revision_checkpoints").update({ due_date: addDays(today, days) }).eq("id", id);
    refetch();
  }

  if (quiz) return <div className="mx-auto max-w-2xl"><QuizRunner items={data.mistakes} onDone={() => { setQuiz(false); refetch(); }} /></div>;

  const Row = ({ c }: { c: Tables<"revision_checkpoints"> }) => {
    const mod = cur.module(c.module_id);
    return (
      <li className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg text-xs font-bold", c.due_date < today ? "bg-destructive/15 text-destructive" : "bg-secondary")}>R{c.stage}</span>
        <div className="flex-1">
          {mod ? <Link to="/study/$moduleId" params={{ moduleId: mod.id }} className="text-sm font-medium hover:text-primary hover:underline">{mod.title} →</Link> : <p className="text-sm font-medium">Module</p>}
          <p className="text-xs text-muted-foreground">{cur.subject(mod?.subject_id)?.short_name} · due {fmtDate(c.due_date)}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => reschedule(c.id, 1)}>Tomorrow</Button>
        <Button size="sm" onClick={() => setDoing(c)}>Revise</Button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Revision Centre" subtitle="Module checkpoints R1–R5 and spaced reviews of your mistakes. Overdue items stay until you do or move them." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={`Module checkpoints · ${overdue.length + due.length} due`}>
            {!data.cps.length ? <Empty icon={<RefreshCw />} title="No checkpoints yet" body="Mark a module complete in the curriculum and SEEFAA schedules R1–R5 at 1, 3, 7, 14 and 30 days." action={<Button asChild size="sm"><Link to="/curriculum">Open curriculum</Link></Button>} /> : (
              <div className="space-y-4">
                {overdue.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase text-destructive">Overdue</p><ul className="space-y-2">{overdue.map((c) => <Row key={c.id} c={c} />)}</ul></div>}
                {due.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase text-primary">Today</p><ul className="space-y-2">{due.map((c) => <Row key={c.id} c={c} />)}</ul></div>}
                {upcoming.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Next 7 days</p><ul className="space-y-2">{upcoming.map((c) => <Row key={c.id} c={c} />)}</ul></div>}
              </div>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title={`Mistakes due · ${data.mistakes.length}`}>
            {data.mistakes.length ? (
              <>
                <p className="text-sm text-muted-foreground">Wrong answers return tomorrow; right answers wait longer each time.</p>
                <Button className="mt-3 w-full" onClick={() => setQuiz(true)}>Reattempt {data.mistakes.length} mistakes</Button>
              </>
            ) : <p className="text-sm text-muted-foreground">All caught up.</p>}
          </Panel>
          <Panel title="Weak concepts">
            {!weak.length ? <p className="text-sm text-muted-foreground">Nothing flagged right now.</p> : (
              <ul className="space-y-1 text-sm">{weak.map(([k, n]) => <li key={k} className="flex justify-between"><span>{cur.module(k)?.title ?? cur.subject(k)?.name ?? k}</span><span className="text-muted-foreground">{n}</span></li>)}</ul>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={!!doing} onOpenChange={(o) => !o && setDoing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>R{doing?.stage} · {cur.module(doing?.module_id)?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><p className="mb-1 text-xs font-medium">Review mode</p><NativeSelect value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</NativeSelect></div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="mb-1 text-xs font-medium">How did it go? (%)</p><Input type="number" min={0} max={100} value={perf} onChange={(e) => setPerf(e.target.value)} /></div>
              <div><p className="mb-1 text-xs font-medium">Confidence</p><NativeSelect value={conf} onChange={(e) => setConf(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></NativeSelect></div>
            </div>
            <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={complete}>Complete checkpoint</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
