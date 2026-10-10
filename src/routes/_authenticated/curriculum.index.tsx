import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader, Bar } from "@/components/seefaa/bits";
import { useCurriculum, useProgress } from "@/hooks/use-seefaa";

export const Route = createFileRoute("/_authenticated/curriculum/")({
  head: () => ({ meta: [{ title: "CFA Curriculum — SEEFAA" }, { name: "description", content: "Track every CFA Level I subject and module." }] }),
  component: CurriculumPage,
});

function CurriculumPage() {
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const [q, setQ] = useState("");
  if (!cur || !prog) return <p className="text-muted-foreground">Loading…</p>;
  const done = new Set(prog.modules.filter((m) => m.status === "completed").map((m) => m.module_id));
  const hits = q.trim().length > 1 ? cur.modules.filter((m) => m.title.toLowerCase().includes(q.toLowerCase())) : [];
  const losHits = q.trim().length > 1 ? cur.los.filter((l) => l.statement.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div>
      <PageHeader title="CFA Curriculum" subtitle="CFA Level I · 2027. Ten subjects, tracked module by module." />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="bg-card pl-9" placeholder="Search modules and LOS…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim().length > 1 ? (
        <div className="card-soft divide-y">
          {[...hits.map((m) => ({ id: m.id, sid: m.subject_id, text: m.title, tag: "Module" })), ...losHits.map((l) => ({ id: l.id, sid: cur.module(l.module_id)?.subject_id ?? "", text: `${l.code} ${l.statement}`, tag: "LOS" }))].map((h) => (
            <Link key={h.id} to="/curriculum/$subjectId" params={{ subjectId: h.sid }} className="flex items-center justify-between p-3 text-sm hover:bg-muted">
              <span>{h.text}</span><span className="text-xs text-muted-foreground">{h.tag} · {cur.subject(h.sid)?.short_name}</span>
            </Link>
          ))}
          {!hits.length && !losHits.length && <p className="p-4 text-sm text-muted-foreground">No matches.</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cur.subjects.map((s) => {
            const mods = cur.modulesOf(s.id);
            const d = mods.filter((m) => done.has(m.id)).length;
            const plan = prog.plans.find((p) => p.subject_id === s.id);
            return (
              <Link key={s.id} to="/curriculum/$subjectId" params={{ subjectId: s.id }} className="card-soft p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  {plan?.status === "active" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-deep">Studying</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{mods.length} modules · ~{s.est_hours}h</p>
                <Bar value={(d / Math.max(1, mods.length)) * 100} className="mt-4" />
                <p className="mt-1 text-xs text-muted-foreground">{d}/{mods.length} complete</p>
              </Link>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Module titles follow the 2027 curriculum. Learning Outcome Statements appear once verified — SEEFAA never invents them.</p>
    </div>
  );
}
