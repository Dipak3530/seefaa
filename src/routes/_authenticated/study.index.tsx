import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenText, CheckCircle2 } from "lucide-react";
import { PageHeader, Bar } from "@/components/seefaa/bits";
import { useCurriculum, useProgress } from "@/hooks/use-seefaa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/study/")({
  head: () => ({ meta: pageMeta("Study Portal — SEEFAA", "Read each CFA Level I 2027 module lesson by lesson, organised by learning outcome.") }),
  component: StudyIndex,
});

function StudyIndex() {
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const [sid, setSid] = useState<string | null>(null);
  if (!cur || !prog) return <p className="text-muted-foreground">Loading…</p>;
  const active = sid ?? cur.subjects[0]?.id;
  const doneLos = new Set(prog.los.filter((l) => l.status === "completed").map((l) => l.los_id));
  const modStatus = (id: string) => prog.modules.find((m) => m.module_id === id)?.status ?? "not_started";
  return (
    <div>
      <PageHeader title="Study Portal" subtitle="Read every module lesson by lesson. Tick off each learning outcome as you master it." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {cur.subjects.map((s) => (
          <button key={s.id} onClick={() => setSid(s.id)} className={cn("shrink-0 rounded-md border-2 px-3 py-1.5 text-sm font-bold transition", active === s.id ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground")}>{s.short_name}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cur.modulesOf(active).map((m, i) => {
          const los = cur.los.filter((l) => l.module_id === m.id);
          const d = los.filter((l) => doneLos.has(l.id)).length;
          const st = modStatus(m.id);
          return (
            <Link key={m.id} to="/study/$moduleId" params={{ moduleId: m.id }} className="card-soft flex min-w-0 flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-primary">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-xs font-bold text-primary">{i + 1}</span>
                <p className="min-w-0 font-bold leading-snug">{m.title}</p>
                {st === "completed" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <BookOpenText className="h-5 w-5 text-muted-foreground" />}
              </div>
              <Bar value={los.length ? (d / los.length) * 100 : 0} />
              <p className="text-xs text-muted-foreground">{los.length ? `${d}/${los.length} LOS mastered` : "Supplementary — no LOS"} · {st.replace("_", " ")}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
