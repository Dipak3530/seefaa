import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Target, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Empty, NativeSelect } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { fmtDate, isoDate } from "@/lib/cfa";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice Sessions — SEEFAA" }, { name: "description", content: "Record and compare your practice results." }] }),
  component: Practice,
});

function Practice() {
  const { data: cur } = useCurriculum();
  const { data: attempt } = useAttempt();
  const inv = useInvalidate();
  const [f, setF] = useState({ subject: "", module: "", total: "", correct: "", minutes: "", source: "", date: isoDate() });
  const { data: list, refetch } = useQuery({
    queryKey: ["practice"],
    queryFn: async () => (await supabase.from("practice_sessions").select("*").order("session_date", { ascending: false })).data ?? [],
  });
  if (!cur) return null;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(f.total), correct = Number(f.correct);
    if (!total || correct < 0 || correct > total) return toast.error("Correct answers must be between 0 and the question count.");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("practice_sessions").insert({
      user_id: u.user!.id, attempt_id: attempt?.id ?? null, subject_id: f.subject || null, module_id: f.module || null,
      total, correct, minutes: f.minutes ? Number(f.minutes) : null, source: f.source || null, session_date: f.date,
    });
    if (error) return toast.error(error.message);
    toast.success("Practice session saved");
    setF({ ...f, total: "", correct: "", minutes: "" });
    refetch(); inv("xp");
  }
  async function del(id: string) {
    if (!confirm("Delete this practice record?")) return;
    await supabase.from("practice_sessions").delete().eq("id", id);
    refetch();
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Practice Sessions" subtitle="Log question sets from any source you use. Results feed your analytics." />
      <Panel title="Record a session">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <NativeSelect value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, module: "" })}><option value="">Subject</option>{cur.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
          <NativeSelect value={f.module} onChange={(e) => setF({ ...f, module: e.target.value })} disabled={!f.subject}><option value="">Module (optional)</option>{cur.modulesOf(f.subject).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</NativeSelect>
          <Input type="number" placeholder="Questions" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} required />
          <Input type="number" placeholder="Correct" value={f.correct} onChange={(e) => setF({ ...f, correct: e.target.value })} required />
          <Input type="number" placeholder="Minutes taken" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
          <Input placeholder="Source (e.g. my question bank)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Button>Save session</Button>
        </form>
      </Panel>
      <Panel title="History">
        {!list?.length ? <Empty icon={<Target />} title="No practice sessions yet" body="Record your first set of questions above." /> : (
          <div className="overflow-x-auto">
             <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Date</th><th>Subject / module</th><th>Score</th><th>Accuracy</th><th>Time</th><th>Source</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{fmtDate(p.session_date)}</td>
                    <td>{cur.subject(p.subject_id)?.short_name ?? "—"}{p.module_id ? ` · ${cur.module(p.module_id)?.title}` : ""}</td>
                    <td>{p.correct}/{p.total}</td>
                    <td className="font-bold text-primary">{Math.round((p.correct / p.total) * 100)}%</td>
                    <td>{p.minutes ? `${p.minutes}m` : "—"}</td>
                    <td className="text-muted-foreground">{p.source ?? "—"}</td>
                    <td><Button size="icon" variant="ghost" onClick={() => del(p.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
