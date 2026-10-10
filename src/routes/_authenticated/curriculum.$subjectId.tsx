import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Bar, NativeSelect } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate, useProfile, useProgress } from "@/hooks/use-seefaa";
import { fmtDate } from "@/lib/cfa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/curriculum/$subjectId")({
  head: () => ({ meta: [{ title: "Subject progress — SEEFAA" }, { name: "description", content: "Modules, LOS, confidence and revision checkpoints for this subject." }] }),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const { data: attempt } = useAttempt();
  const { data: profile } = useProfile();
  const inv = useInvalidate();
  const { data: extra } = useQuery({
    queryKey: ["subject-extra", attempt?.id, subjectId],
    enabled: !!attempt,
    queryFn: async () => {
      const [cp, mk, pr] = await Promise.all([
        supabase.from("revision_checkpoints").select("*").eq("attempt_id", attempt!.id),
        supabase.from("mistakes").select("module_id").eq("subject_id", subjectId),
        supabase.from("practice_sessions").select("module_id,total,correct").eq("subject_id", subjectId),
      ]);
      return { cps: cp.data ?? [], mistakes: mk.data ?? [], practice: pr.data ?? [] };
    },
  });
  if (!cur || !prog || !attempt || !profile) return <p className="text-muted-foreground">Loading…</p>;
  const subject = cur.subject(subjectId);
  if (!subject) return <p>Subject not found.</p>;
  const mods = cur.modulesOf(subjectId);
  const pm = (id: string) => prog.modules.find((m) => m.module_id === id);
  const d = mods.filter((m) => pm(m.id)?.status === "completed").length;

  async function setModule(moduleId: string, patch: { status?: string; confidence?: string | null }) {
    const existing = pm(moduleId);
    const today = new Date().toISOString().slice(0, 10);
    const row = { user_id: profile!.id, attempt_id: attempt!.id, module_id: moduleId, status: existing?.status ?? "not_started", confidence: existing?.confidence ?? null, ...patch,
      studied_on: patch.status === "completed" ? existing?.studied_on ?? today : existing?.studied_on ?? null };
    const { error } = await supabase.from("module_progress").upsert(row, { onConflict: "attempt_id,module_id" });
    if (error) return toast.error(error.message);
    if (patch.status === "completed" && existing?.status !== "completed") toast.success("Module complete! R1–R5 revisions scheduled.");
    inv("progress", "subject-extra", "xp");
  }
  async function setLos(losId: string, status: string) {
    const { error } = await supabase.from("los_progress").upsert({ user_id: profile!.id, attempt_id: attempt!.id, los_id: losId, status }, { onConflict: "attempt_id,los_id" });
    if (error) return toast.error(error.message);
    inv("progress", "xp");
  }

  return (
    <div>
      <Link to="/curriculum" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> All subjects</Link>
      <PageHeader title={subject.name} subtitle={`${d} of ${mods.length} modules complete`} actions={<><Button asChild variant="outline"><Link to="/formulas">Formula notebook</Link></Button><Button asChild><Link to="/mistakes">Review mistakes</Link></Button></>} />
      <Bar value={(d / Math.max(1, mods.length)) * 100} className="mb-6 h-3" />
      <div className="space-y-3">
        {mods.map((m, i) => {
          const p = pm(m.id);
          const cps = (extra?.cps ?? []).filter((c) => c.module_id === m.id).sort((a, b) => a.stage - b.stage);
          const mistakes = (extra?.mistakes ?? []).filter((x) => x.module_id === m.id).length;
          const pr = (extra?.practice ?? []).filter((x) => x.module_id === m.id);
          const tot = pr.reduce((a, x) => a + x.total, 0);
          const acc = tot ? Math.round((pr.reduce((a, x) => a + x.correct, 0) / tot) * 100) : null;
          const los = cur.los.filter((l) => l.module_id === m.id);
          return (
            <div key={m.id} className="card-soft p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-primary">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-medium">{m.title}{m.needs_verification && <span className="ml-2 rounded bg-sun/40 px-1.5 py-0.5 text-[10px]">needs verification</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {p?.studied_on ? `Studied ${fmtDate(p.studied_on)} · ` : ""}{mistakes} linked mistake{mistakes === 1 ? "" : "s"}{acc != null ? ` · practice ${acc}% (${tot} Qs)` : ""}
                  </p>
                </div>
                <NativeSelect className="col-start-2 w-full sm:col-start-auto sm:w-36" value={p?.status ?? "not_started"} onChange={(e) => setModule(m.id, { status: e.target.value })} aria-label="Status">
                  <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
                </NativeSelect>
                <NativeSelect className="col-start-2 w-full sm:col-start-auto sm:w-32" value={p?.confidence ?? ""} onChange={(e) => setModule(m.id, { confidence: e.target.value || null })} aria-label="Confidence">
                  <option value="">Confidence</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </NativeSelect>
              </div>
              {cps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cps.map((c) => (
                    <span key={c.id} className={cn("rounded-md border px-2.5 py-1 text-[11px]", c.completed_at ? "border-primary bg-accent text-primary" : "bg-background text-muted-foreground")}>R{c.stage} · {c.completed_at ? "done" : fmtDate(c.due_date)}</span>
                  ))}
                </div>
              )}
              {los.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-3">
                  {los.map((l) => {
                    const lp = prog.los.find((x) => x.los_id === l.id);
                    return (
                      <li key={l.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={lp?.status === "completed"} onChange={(e) => setLos(l.id, e.target.checked ? "completed" : "in_progress")} />
                        <span className="text-xs text-muted-foreground">{l.code}</span> {l.statement}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
