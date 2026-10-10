import { pageMeta } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, Empty } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { fmtDate, isoDate } from "@/lib/cfa";

export const Route = createFileRoute("/_authenticated/mocks")({
  head: () => ({ meta: pageMeta("Mock Exams — SEEFAA", "Track mock exam scores over time.") }),
  component: Mocks,
});

function Mocks() {
  const { data: cur } = useCurriculum();
  const { data: attempt } = useAttempt();
  const inv = useInvalidate();
  const [name, setName] = useState("");
  const [date, setDate] = useState(isoDate());
  const [score, setScore] = useState("");
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [timeNotes, setTimeNotes] = useState("");
  const [weak, setWeak] = useState("");
  const { data: list, refetch } = useQuery({
    queryKey: ["mocks"],
    queryFn: async () => (await supabase.from("mock_exams").select("*").order("exam_date")).data ?? [],
  });
  if (!cur) return null;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const s = Number(score);
    if (isNaN(s) || s < 0 || s > 100) return toast.error("Score must be 0–100%.");
    const { data: u } = await supabase.auth.getUser();
    const subject_scores = Object.fromEntries(Object.entries(subs).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
    const { error } = await supabase.from("mock_exams").insert({ user_id: u.user!.id, attempt_id: attempt?.id ?? null, name, exam_date: date, score_pct: s, subject_scores, time_notes: timeNotes || null, weak_areas: weak || null });
    if (error) return toast.error(error.message);
    toast.success("Mock saved · +20 XP");
    setName(""); setScore(""); setSubs({}); setTimeNotes(""); setWeak("");
    refetch(); inv("xp");
  }
  async function del(id: string) {
    if (!confirm("Delete this mock result?")) return;
    await supabase.from("mock_exams").delete().eq("id", id);
    refetch();
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Mock Exams" subtitle="Your actual mock results. SEEFAA never turns these into a pass prediction." />
      {list && list.length >= 2 && (
        <Panel title="Score history">
          <div className="h-56"><ResponsiveContainer><LineChart data={list.map((m) => ({ name: m.name, score: Number(m.score_pct) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="name" fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} /><Tooltip />
            <Line dataKey="score" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart></ResponsiveContainer></div>
        </Panel>
      )}
      <Panel title="Add a mock result">
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Mock name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="number" placeholder="Overall score %" value={score} onChange={(e) => setScore(e.target.value)} required />
          </div>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Subject scores (optional)</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {cur.subjects.map((s) => <Input key={s.id} type="number" placeholder={`${s.short_name} %`} value={subs[s.id] ?? ""} onChange={(e) => setSubs({ ...subs, [s.id]: e.target.value })} />)}
            </div>
          </details>
          <div className="grid gap-2 sm:grid-cols-2">
            <Textarea placeholder="Time-management notes" value={timeNotes} onChange={(e) => setTimeNotes(e.target.value)} />
            <Textarea placeholder="Weak areas / mistakes to review" value={weak} onChange={(e) => setWeak(e.target.value)} />
          </div>
          <Button>Save mock</Button>
        </form>
      </Panel>
      {!list?.length ? <Empty icon={<ClipboardCheck />} title="No mocks yet" body="Your plan schedules mocks in the final weeks before the exam." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {[...list].reverse().map((m) => (
            <div key={m.id} className="card-soft p-4">
              <div className="flex items-start justify-between">
                <div><p className="font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">{fmtDate(m.exam_date)}</p></div>
                <div className="flex items-center gap-1"><span className="font-display text-2xl font-semibold text-deep">{Number(m.score_pct)}%</span><Button size="icon" variant="ghost" onClick={() => del(m.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
              {Object.keys(m.subject_scores as object).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">{Object.entries(m.subject_scores as Record<string, number>).map(([k, v]) => <span key={k} className="rounded bg-secondary px-1.5 py-0.5">{cur.subject(k)?.short_name} {v}%</span>)}</div>
              )}
              {m.weak_areas && <p className="mt-2 text-sm"><b className="text-xs">Weak areas:</b> {m.weak_areas}</p>}
              {m.time_notes && <p className="mt-1 text-sm text-muted-foreground">{m.time_notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
