import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { prioritizeRevisions } from "@/lib/revision-priority";

export function SuggestedRevision({ onPick }: { onPick?: (subjectId: string, moduleId: string) => void }) {
  const { data: attempt } = useAttempt();
  const { data: cur } = useCurriculum();
  const inv = useInvalidate();
  const [picked, setPicked] = useState<string | null>(null);
  const [perf, setPerf] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["revision-suggest", attempt?.id],
    enabled: !!attempt,
    queryFn: async () => {
      const { data } = await supabase.from("revision_checkpoints").select("*").eq("attempt_id", attempt!.id).is("completed_at", null);
      return prioritizeRevisions(data ?? []);
    },
  });

  if (!list.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const selected = list.find((c) => c.id === picked) ?? list[0];

  async function log() {
    setSaving(true);
    const { error } = await supabase.from("revision_checkpoints")
      .update({ completed_at: new Date().toISOString(), performance: perf })
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`R${selected.stage} logged`);
    setPicked(null); setPerf(null);
    inv("revision-suggest", "dashboard", "revisions", "xp");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Suggested revision</p>
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {list.slice(0, 8).map((c, i) => {
          const m = cur?.module(c.module_id);
          const s = cur?.subject(m?.subject_id);
          const active = c.id === selected.id;
          const overdue = c.due_date < today;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { setPicked(c.id); if (m) onPick?.(m.subject_id, m.id); }}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${active ? "border-primary bg-accent" : "border-border bg-background hover:border-foreground/40"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-foreground text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-card"}`}>R{c.stage}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m?.title ?? c.module_id}</span>
                  <span className="block text-xs text-muted-foreground">{s?.short_name ?? s?.name} · {overdue ? "overdue · " : ""}due {c.due_date}</span>
                </span>
                {i === 0 && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Top pick</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">How did it go?</span>
        {[40, 70, 90].map((p) => (
          <button key={p} type="button" onClick={() => setPerf(perf === p ? null : p)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${perf === p ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
            {p === 40 ? "Shaky" : p === 70 ? "Okay" : "Strong"}
          </button>
        ))}
        <Button size="sm" className="ml-auto" onClick={log} loading={saving}>
          <Check className="h-4 w-4" /> Log R{selected.stage}
        </Button>
      </div>
    </div>
  );
}
