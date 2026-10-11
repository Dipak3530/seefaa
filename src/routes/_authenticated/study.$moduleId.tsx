import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronLeft, ChevronRight, Library, Sigma } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, NativeSelect, Panel } from "@/components/seefaa/bits";
import { Button } from "@/components/ui/button";
import { useAttempt, useCurriculum, useInvalidate, useProfile, useProgress } from "@/hooks/use-seefaa";
import { moduleNumber, parsePracticeItems, sectionsForLos, solutionLetter, tagSections, useSubjectContent, type ContentSection, type PracticeQuestion } from "@/lib/study-content";
import { QuestionCard, QuestionText } from "@/components/seefaa/question";
import { REFERENCE_FORMULAS, referenceMatches } from "@/lib/formula-reference";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/study/$moduleId")({
  head: () => ({ meta: pageMeta("Module lessons — SEEFAA Study Portal", "Lesson-by-lesson module content linked to LOS progress, mistakes and formulas.") }),
  component: StudyModule,
});

function StudyModule() {
  const { moduleId } = Route.useParams();
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const { data: attempt } = useAttempt();
  const { data: profile } = useProfile();
  const inv = useInvalidate();
  const mod = cur?.module(moduleId);
  const { data: content, isLoading, error } = useSubjectContent(mod?.subject_id);
  const [losFilter, setLosFilter] = useState<number | null>(null);
  const [open, setOpen] = useState(0);
  const { data: linked } = useQuery({
    queryKey: ["study-linked", moduleId, mod?.subject_id],
    enabled: !!mod,
    queryFn: async () => {
      const [mk, fm] = await Promise.all([
        supabase.from("mistakes").select("id,question,concept,los_id,mastery,next_review").eq("module_id", moduleId).order("created_at", { ascending: false }),
        supabase.from("formulas").select("id,name,expression,module_id").eq("subject_id", mod!.subject_id),
      ]);
      return { mistakes: mk.data ?? [], formulas: fm.data ?? [] };
    },
  });
  const mc = useMemo(() => content?.find((c) => c.num === moduleNumber(moduleId)), [content, moduleId]);

  if (!cur || !prog || !attempt || !profile) return <p className="text-muted-foreground">Loading…</p>;
  if (!mod) return <p>Module not found.</p>;
  const subject = cur.subject(mod.subject_id)!;
  const siblings = cur.modulesOf(mod.subject_id);
  const idx = siblings.findIndex((m) => m.id === moduleId);
  const los = cur.los.filter((l) => l.module_id === moduleId);
  const lp = (id: string) => prog.los.find((x) => x.los_id === id);
  const doneCount = los.filter((l) => lp(l.id)?.status === "completed").length;
  const mp = prog.modules.find((m) => m.module_id === moduleId);
  const sections = mc ? sectionsForLos(tagSections(mc), losFilter) : [];
  const refs = REFERENCE_FORMULAS.filter((f) => referenceMatches(f, subject.name, ""));
  const mistakes = (linked?.mistakes ?? []).filter((m) => losFilter == null || m.los_id === los[losFilter - 1]?.id);

  async function setLos(losId: string, status: string) {
    const { error } = await supabase.from("los_progress").upsert({ user_id: profile!.id, attempt_id: attempt!.id, los_id: losId, status }, { onConflict: "attempt_id,los_id" });
    if (error) return toast.error(error.message);
    if (status === "completed") toast.success("LOS mastered · +XP");
    inv("progress", "xp");
  }
  async function setModule(status: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("module_progress").upsert({ user_id: profile!.id, attempt_id: attempt!.id, module_id: moduleId, status, confidence: mp?.confidence ?? null,
      studied_on: status === "completed" ? mp?.studied_on ?? today : mp?.studied_on ?? null }, { onConflict: "attempt_id,module_id" });
    if (error) return toast.error(error.message);
    if (status === "completed" && mp?.status !== "completed") toast.success("Module complete! R1–R5 revisions scheduled.");
    inv("progress", "xp", "subject-extra");
  }

  return (
    <div>
      <Link to="/curriculum/$subjectId" params={{ subjectId: mod.subject_id }} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> {subject.name}</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">{subject.name} · Module {idx + 1}</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight md:text-3xl">{mod.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{los.length ? `${doneCount}/${los.length} LOS mastered` : "Supplementary material"}</p>
        </div>
        <NativeSelect className="w-40" value={mp?.status ?? "not_started"} onChange={(e) => setModule(e.target.value)} aria-label="Module status">
          <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
        </NativeSelect>
      </div>
      <Bar value={los.length ? (doneCount / los.length) * 100 : 0} className="mb-6 h-3" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {los.length > 0 && (
            <Panel title="Learning outcomes">
              <ul className="space-y-2">
                {los.map((l, i) => {
                  const done = lp(l.id)?.status === "completed";
                  return (
                    <li key={l.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md border-2 p-3 text-sm transition", losFilter === i + 1 ? "border-primary bg-accent" : "border-transparent")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={done} aria-label={`Mark ${l.code} mastered`} onChange={(e) => setLos(l.id, e.target.checked ? "completed" : "in_progress")} />
                      <span className={cn("min-w-0", done && "text-muted-foreground line-through")}><b className="mr-1 text-primary">{l.code}</b>{l.statement}</span>
                      <Button size="sm" variant={losFilter === i + 1 ? "default" : "outline"} onClick={() => { setLosFilter(losFilter === i + 1 ? null : i + 1); setOpen(0); }}>{losFilter === i + 1 ? "All" : "Study"}</Button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Extracted from your 2027 curriculum PDF — check against the official text if anything reads oddly.</p>
            </Panel>
          )}

          <div>
            <h2 className="mb-3 font-display text-lg font-bold">{losFilter ? `Lessons for LOS ${losFilter}` : "All lessons"}</h2>
            {isLoading && <p className="text-sm text-muted-foreground">Loading lessons…</p>}
            {error && <p className="text-sm text-destructive">Couldn’t load lessons. Please refresh.</p>}
            {content && !mc && <p className="text-sm text-muted-foreground">No lesson text is available for this module.</p>}
            {mc && !sections.length && <p className="text-sm text-muted-foreground">No lessons are tagged to this LOS in the source. Show all lessons to read the full module.</p>}
            <div className="space-y-3">
              {sections.map((s, i) => <Lesson key={`${losFilter}-${i}`} s={s} moduleTitle={mod.title} subjectId={mod.subject_id} moduleId={moduleId} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />)}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            {idx > 0 ? <Button asChild variant="outline"><Link to="/study/$moduleId" params={{ moduleId: siblings[idx - 1].id }}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Link></Button> : <span />}
            {idx < siblings.length - 1 && <Button asChild><Link to="/study/$moduleId" params={{ moduleId: siblings[idx + 1].id }}>Next module<ChevronRight className="ml-1 h-4 w-4" /></Link></Button>}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel title={`Mistakes${losFilter ? ` · LOS ${losFilter}` : ""}`} action={<Button asChild size="sm" variant="outline"><Link to="/error-log"><Camera className="mr-1 h-3.5 w-3.5" />Log</Link></Button>}>
            {!mistakes.length ? <p className="text-sm text-muted-foreground">No mistakes logged here yet.</p> : (
              <ul className="space-y-2">
                {mistakes.slice(0, 8).map((m) => (
                  <li key={m.id}><Link to="/mistakes/$id" params={{ id: m.id }} className="block rounded-md border p-2 text-sm hover:border-primary">
                    <span className="line-clamp-2">{m.concept || m.question}</span>
                    <span className="text-[11px] text-muted-foreground">{m.mastery} · review {m.next_review}</span>
                  </Link></li>
                ))}
              </ul>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-2 w-full"><Link to="/mistakes"><Library className="mr-1 h-3.5 w-3.5" />Mistake bank</Link></Button>
          </Panel>
          <Panel title={`${subject.short_name} formulas`} action={<Button asChild size="sm" variant="outline"><Link to="/formulas"><Sigma className="mr-1 h-3.5 w-3.5" />All</Link></Button>}>
            {(linked?.formulas ?? []).length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">My notebook</p>
                {(linked?.formulas ?? []).map((f) => <div key={f.id} className={cn("mb-2 rounded-md border p-2", f.module_id === moduleId && "border-primary")}><p className="text-xs font-bold">{f.name}</p><p className="break-words font-mono text-xs">{f.expression}</p></div>)}
              </div>
            )}
            <p className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">Cheat sheet · 2025</p>
            {!refs.length ? <p className="text-sm text-muted-foreground">No formulas for this subject.</p> : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {refs.map((f) => <div key={f.id} className="rounded-md border bg-background p-2"><p className="text-xs font-bold">{f.name}</p><p className="whitespace-pre-wrap break-words font-mono text-xs">{f.expression}</p></div>)}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Lesson({ s, moduleTitle, subjectId, moduleId, open, onToggle }: { s: ContentSection; moduleTitle: string; subjectId: string; moduleId: string; open: boolean; onToggle: () => void }) {
  const isPractice = /practice problem/i.test(s.title);
  const isSolutions = /^solutions?$/i.test(s.title.trim());
  const items = useMemo(() => (isPractice || isSolutions) ? parsePracticeItems(s.blocks, [s.title, moduleTitle]) : [], [s, moduleTitle, isPractice, isSolutions]);
  return (
    <article className="card-soft overflow-hidden">
      <button onClick={onToggle} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left">
        <span className="min-w-0 font-bold">{s.title}{items.length > 0 && <span className="ml-2 text-xs font-medium text-muted-foreground">{items.length} {isSolutions ? "worked solutions" : "questions"}</span>}</span>
        <span className="flex gap-1">{s.los.map((n) => <span key={n} className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-primary">LOS {n}</span>)}</span>
      </button>
      {open && (items.length > 0 ? (
        <ol className="space-y-6 border-t px-4 py-4 md:px-6">
          {items[0]?.vignette && (
            <li className="rounded-lg border bg-accent/40 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Scenario · questions {items[0].n}–{items[items.length - 1].n}</p>
              <QuestionText text={items[0].vignette} />
            </li>
          )}
          {items.map((q) => (
            <li key={q.n}>
              {isSolutions || q.choices.length === 0
                ? <QuestionCard number={q.n} eyebrow={isSolutions ? "Worked solution" : "Practice question"} stem={q.stem} choices={q.choices} />
                : <PortalQuestion q={q} subjectId={subjectId} moduleId={moduleId} />}
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-3 border-t px-4 py-4 text-[15px] leading-7 md:px-6">
          {s.blocks.map((b, i) => b.t === "h" ? <h4 key={i} className="pt-2 font-display font-bold text-primary">{b.x}</h4>
            : b.t === "table" ? <pre key={i} className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs leading-5">{b.x}</pre>
            : <p key={i} className="break-words">{b.x}</p>)}
        </div>
      ))}
    </article>
  );
}

function PortalQuestion({ q, subjectId, moduleId }: { q: PracticeQuestion; subjectId: string; moduleId: string }) {
  const { data: attempt } = useAttempt();
  const inv = useInvalidate();
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<"right" | "logged" | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const answer = solutionLetter(q);

  async function logMistake(choice: string) {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again");
      const { data: existing } = await supabase.from("mistakes").select("id").eq("module_id", moduleId).eq("question", q.stem).limit(1);
      if (existing?.length) {
        await supabase.from("mistakes").update({ selected_answer: choice, correct_answer: answer, correct_verified: !!answer, updated_at: new Date().toISOString() }).eq("id", existing[0].id);
      } else {
        const { error } = await supabase.from("mistakes").insert({
          user_id: u.user.id, attempt_id: attempt?.id ?? null, version_id: attempt?.version_id ?? "2027-L1",
          subject_id: subjectId, module_id: moduleId, question: q.stem, choices: q.choices,
          selected_answer: choice, correct_answer: answer, correct_verified: !!answer,
          concept: `Practice problem ${q.n}`, notes: "Logged from the Study Portal practice problems.", error_category: "conceptual",
        });
        if (error) throw error;
      }
      inv();
      toast.success("Added to your mistake log for this module");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log this mistake");
    } finally { setBusy(false); }
  }

  async function choose(label: string) {
    if (result || busy) return;
    setPicked(label);
    if (!answer) return; // no verified key — ask the student to self-check
    if (label === answer) { setResult("right"); setShowSolution(true); }
    else { setResult("logged"); setShowSolution(true); await logMistake(label); }
  }

  async function markWrong() {
    if (!picked) return;
    await logMistake(picked);
    setResult("logged");
  }

  return (
    <div className="space-y-3">
      <QuestionCard number={q.n} eyebrow="Practice question" stem={q.stem} choices={q.choices}
        choiceState={(l) => {
          if (l === picked) return result === "right" ? "correct" : result === "logged" ? "incorrect" : "selected";
          if (result && answer && l === answer) return "correct";
          return "default";
        }}
        onSelect={result ? undefined : choose} disabled={busy} />
      {picked && !result && !answer && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="mr-auto text-sm">You chose <b>{picked}</b>. Check it against the curriculum solution:</span>
          <Button size="sm" variant="outline" onClick={() => setResult("right")}>I got it right</Button>
          <Button size="sm" onClick={markWrong} disabled={busy}>{busy ? "Logging…" : "I got it wrong — log it"}</Button>
        </div>
      )}
      {result && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-auto font-semibold">{result === "right" ? "Correct — nice work." : "Saved to your mistake log."}</span>
          {result === "logged" && <Link to="/mistakes" className="font-bold text-primary underline">Open mistake log</Link>}
          <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setResult(null); setShowSolution(false); }}>Try again</Button>
        </div>
      )}
      {q.solution && (
        <div>
          <Button size="sm" variant="outline" onClick={() => setShowSolution((v) => !v)}>{showSolution ? "Hide solution" : "Show solution"}</Button>
          {showSolution && <div className="mt-2 rounded-lg border bg-accent/40 p-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Curriculum solution</p><QuestionText text={q.solution} /></div>}
        </div>
      )}
    </div>
  );
}
