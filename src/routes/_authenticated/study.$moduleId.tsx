import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, NativeSelect, Panel } from "@/components/seefaa/bits";
import { Button } from "@/components/ui/button";
import { useAttempt, useCurriculum, useInvalidate, useProfile, useProgress } from "@/hooks/use-seefaa";
import { moduleNumber, parsePracticeItems, solutionLetter, useSubjectContent, type PracticeQuestion } from "@/lib/study-content";
import { QuestionCard, QuestionText } from "@/components/seefaa/question";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/study/$moduleId")({
  head: () => ({ meta: pageMeta("Module practice & LOS — SEEFAA", "Interactive CFA Level I module practice questions and learning outcome progress.") }),
  component: StudyModule,
});

function StudyModule() {
  const { moduleId } = Route.useParams();
  return <ModulePractice key={moduleId} moduleId={moduleId} />;
}

function ModulePractice({ moduleId }: { moduleId: string }) {
  const navigate = useNavigate();
  const { data: cur } = useCurriculum();
  const { data: prog } = useProgress();
  const { data: attempt } = useAttempt();
  const { data: profile } = useProfile();
  const inv = useInvalidate();
  const mod = cur?.module(moduleId);
  const { data: content, isLoading, error } = useSubjectContent(mod?.subject_id);
  const [practicing, setPracticing] = useState(false);
  const mc = content?.find(c => c.num === moduleNumber(moduleId));
  const sets = useMemo(() => mc?.sections.filter(s => /practice problems?/i.test(s.title)).map(s => ({
    title: s.title, items: parsePracticeItems([...s.blocks, ...mc.sections.filter(section => /^solutions?$/i.test(section.title.trim())).flatMap(section => section.blocks)], [s.title, mod?.title ?? ""]),
  })) ?? [], [mc, mod?.title]);
  const questionCount = sets.reduce((sum, set) => sum + set.items.length, 0);
  const { data: logged } = useQuery({
    queryKey: ["module-logged-questions", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("mistakes").select("*").eq("module_id", moduleId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  // Website questions answered wrongly are already shown above as website questions; only user-logged (screenshot/manual) ones appear here.
  const mine = (logged ?? []).filter(m => !(m.notes ?? "").startsWith("Logged from the Study Portal"));

  if (!cur || !prog || !attempt || !profile) return <p className="text-muted-foreground">Loading…</p>;
  if (!mod) return <p>Module not found.</p>;
  const subject = cur.subject(mod.subject_id);
  if (!subject) return <p>Subject not found.</p>;
  const siblings = cur.modulesOf(mod.subject_id);
  const idx = siblings.findIndex(m => m.id === moduleId);
  const los = cur.los.filter(l => l.module_id === moduleId);
  const lp = (id: string) => prog.los.find(x => x.los_id === id);
  const doneCount = los.filter(l => lp(l.id)?.status === "completed").length;
  const mp = prog.modules.find(m => m.module_id === moduleId);
  const userId = profile.id;
  const attemptId = attempt.id;

  async function setLos(losId: string, status: string) {
    const { error } = await supabase.from("los_progress").upsert({ user_id: userId, attempt_id: attemptId, los_id: losId, status }, { onConflict: "attempt_id,los_id" });
    if (error) return toast.error(error.message);
    if (status === "completed") toast.success("LOS mastered · +XP");
    inv("progress", "xp");
  }
  async function setModule(status: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("module_progress").upsert({ user_id: userId, attempt_id: attemptId, module_id: moduleId, status, confidence: mp?.confidence ?? null,
      studied_on: status === "completed" ? mp?.studied_on ?? today : mp?.studied_on ?? null }, { onConflict: "attempt_id,module_id" });
    if (error) return toast.error(error.message);
    if (status === "completed" && mp?.status !== "completed") toast.success("Module complete! R1–R5 revisions scheduled.");
    inv("progress", "xp", "subject-extra");
  }

  return (
    <div>
      <Link to="/curriculum/$subjectId" params={{ subjectId: mod.subject_id }} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />{subject.name} · Subject analytics & modules</Link>
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <NativeSelect value={moduleId} aria-label="Choose subject module" onChange={e => navigate({ to: "/study/$moduleId", params: { moduleId: e.target.value } })}>
          {siblings.map((m, i) => <option key={m.id} value={m.id}>{i + 1}. {m.title}</option>)}
        </NativeSelect>
        <NativeSelect value={mp?.status ?? "not_started"} onChange={e => setModule(e.target.value)} aria-label="Module status">
          <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
        </NativeSelect>
      </div>
      <p className="text-xs font-bold uppercase text-primary">{subject.name} · Module {idx + 1}</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight md:text-3xl">{mod.title}</h1>
      <p className="mt-2 mb-4 text-sm text-muted-foreground">{doneCount}/{los.length} LOS mastered</p>
      <Bar value={los.length ? doneCount / los.length * 100 : 0} className="mb-6 h-3" />
      <Panel title="Learning outcomes">
        {!los.length ? <p className="text-sm text-muted-foreground">No verified LOS titles available for this module.</p> : <ul className="space-y-3">
          {los.map(l => <li key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={lp(l.id)?.status === "completed"} aria-label={`Mark ${l.code} mastered`} onChange={e => setLos(l.id, e.target.checked ? "completed" : "in_progress")} />
            <span className={cn(lp(l.id)?.status === "completed" && "text-muted-foreground")}><b className="mr-2 text-primary">{l.code}</b>{l.statement}</span>
          </li>)}
        </ul>}
      </Panel>
      <Panel title="Practice questions" action={<Button onClick={() => setPracticing(v => !v)} disabled={isLoading || !(questionCount + mine.length)}><Play className="mr-2 h-4 w-4" />{practicing ? "Close practice" : "Practice"}</Button>}>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading questions…</p> : error ? <p className="text-sm text-destructive">Couldn’t load practice questions. Please refresh.</p> : <p className="text-sm text-muted-foreground">{questionCount + mine.length ? `${questionCount} website questions · ${mine.length} your logged questions` : "No practice questions available for this module."}</p>}
        {practicing && <div className="mt-5 space-y-8">
          {mine.length > 0 && <div>
            <p className="mb-3 inline-block rounded-full border-2 border-foreground bg-secondary px-3 py-1 text-xs font-bold uppercase">Your logged questions · {mine.length}</p>
            <ol className="space-y-6">{mine.map((m, i) => <li key={m.id}><LoggedQuestion m={m} n={i + 1} /></li>)}</ol>
          </div>}
          {questionCount > 0 && <p className="inline-block rounded-full border-2 border-foreground bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">Website questions · {questionCount}</p>}
          {sets.map((set, i) => <div key={i}>
          <ol className="space-y-6">
            {set.items.map(q => <li key={q.n}>{q.choices.length ? <PortalQuestion q={q} subjectId={mod.subject_id} moduleId={moduleId} /> : <QuestionCard number={q.n} eyebrow="Website question" stem={q.stem} choices={q.choices} />}</li>)}
          </ol>
        </div>)}</div>}
      </Panel>
      <div className="mt-6 flex justify-between gap-3">
        {idx > 0 ? <Button asChild variant="outline"><Link to="/study/$moduleId" params={{ moduleId: siblings[idx - 1].id }}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Link></Button> : <span />}
        {idx < siblings.length - 1 && <Button asChild><Link to="/study/$moduleId" params={{ moduleId: siblings[idx + 1].id }}>Next module<ChevronRight className="ml-1 h-4 w-4" /></Link></Button>}
      </div>
    </div>
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
      {q.vignette && <div className="rounded-lg border bg-accent/40 p-4"><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Scenario</p><QuestionText text={q.vignette} /></div>}
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

function LoggedQuestion({ m, n }: { m: Tables<"mistakes">; n: number }) {
  const inv = useInvalidate();
  const qc = useQueryClient();
  const choices = (Array.isArray(m.choices) ? m.choices : []) as { label: string; text: string }[];
  const answer = m.correct_answer && choices.some(c => c.label === m.correct_answer) ? m.correct_answer : null;
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<"right" | "wrong" | null>(null);

  async function record(label: string, correct: boolean) {
    const { error } = await supabase.from("mistake_attempts").insert({ user_id: m.user_id, mistake_id: m.id, answer: label, is_correct: correct });
    if (error) return toast.error(error.message);
    setResult(correct ? "right" : "wrong");
    toast.success(correct ? "Correct — review pushed further out" : "Recorded — this one comes back tomorrow");
    inv(); qc.invalidateQueries({ queryKey: ["module-logged-questions", m.module_id] });
  }
  function choose(label: string) {
    if (result) return;
    setPicked(label);
    if (answer) record(label, label === answer);
  }

  return (
    <div className="space-y-3">
      <QuestionCard number={n} eyebrow={m.concept ? `Your logged question · ${m.concept}` : "Your logged question"} stem={m.question} choices={choices}
        choiceState={(l) => {
          if (l === picked) return result === "right" ? "correct" : result === "wrong" ? "incorrect" : "selected";
          if (result && answer && l === answer) return "correct";
          return "default";
        }}
        onSelect={result ? undefined : choose} />
      {picked && !result && !answer && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="mr-auto text-sm">You chose <b>{picked}</b>. No answer key saved — self-check:</span>
          <Button size="sm" variant="outline" onClick={() => record(picked, true)}>I got it right</Button>
          <Button size="sm" onClick={() => record(picked, false)}>I got it wrong</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {result && <span className="mr-auto font-semibold">{result === "right" ? "Correct — nice work." : `Not quite${answer ? ` — answer is ${answer}` : ""}.`}</span>}
        <Link to="/mistakes/$id" params={{ id: m.id }} className="font-bold text-primary underline">Open in mistake bank</Link>
        {result && <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setResult(null); }}>Try again</Button>}
      </div>
    </div>
  );
}
