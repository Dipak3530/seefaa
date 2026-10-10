import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader, Bar } from "@/components/seefaa/bits";
import { useCurriculum, useProgress } from "@/hooks/use-seefaa";

export const Route = createFileRoute("/_authenticated/curriculum/")({
  head: () => ({ meta: pageMeta("CFA Curriculum — SEEFAA", "Track every CFA Level I subject and module.") }),
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
         <Input className="bg-card pl-9" aria-label="Search curriculum" placeholder="Search modules and LOS…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim().length > 1 ? (
        <div className="card-soft divide-y">
          {[...hits.map((m) => ({ id: m.id, sid: m.subject_id, text: m.title, tag: "Module" })), ...losHits.map((l) => ({ id: l.id, sid: cur.module(l.module_id)?.subject_id ?? "", text: `${l.code} ${l.statement}`, tag: "LOS" }))].map((h) => (
            <Link key={h.id} to="/curriculum/$subjectId" params={{ subjectId: h.sid }} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-sm hover:bg-muted">
              <span className="min-w-0 break-words">{h.text}</span><span className="text-xs text-muted-foreground">{h.tag} · {cur.subject(h.sid)?.short_name}</span>
            </Link>
          ))}
          {!hits.length && !losHits.length && <p className="p-4 text-sm text-muted-foreground">No matches.</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cur.subjects.map((s, i) => {
            const mods = cur.modulesOf(s.id);
            const d = mods.filter((m) => done.has(m.id)).length;
            const plan = prog.plans.find((p) => p.subject_id === s.id);
            return (
              <Link key={s.id} to="/curriculum/$subjectId" params={{ subjectId: s.id }} className={`card-soft flex min-w-0 flex-col p-5 transition hover:-translate-y-0.5 hover:border-primary ${plan?.status === "active" ? "border-primary" : ""}`}>
                <div className="mb-5 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-md bg-accent text-primary"><BookOpen className="h-5 w-5" /></span><span className="font-display text-sm font-bold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span></div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <h3 className="min-w-0 text-base font-bold">{s.name}</h3>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
                <p className="mb-5 mt-2 text-xs text-muted-foreground">{mods.length} modules · ~{s.est_hours}h {plan?.status === "active" && <span className="ml-1 font-bold text-primary">· Studying</span>}</p>
                <Bar value={(d / Math.max(1, mods.length)) * 100} className="mt-auto" />
                <div className="mt-2 flex justify-between text-xs"><span className="text-muted-foreground">{d}/{mods.length} complete</span><span className="font-bold text-primary">{Math.round(d / Math.max(1, mods.length) * 100)}%</span></div>
                 <p className="mt-2 text-xs text-muted-foreground">{mods.filter(m => prog.modules.some(p => p.module_id === m.id && p.status === "in_progress")).length} in progress</p>
              </Link>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Module titles follow the 2027 curriculum. Learning Outcome Statements appear once verified — SEEFAA never invents them.</p>
    </div>
  );
}
