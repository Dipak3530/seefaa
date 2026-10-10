import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Panel, Markdown, NativeSelect } from "@/components/seefaa/bits";
import { QuizRunner } from "@/components/seefaa/quiz";
import { AnswerChoice, QuestionText } from "@/components/seefaa/question";
import { useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { ERROR_CATEGORIES, categoryLabel, fmtDate } from "@/lib/cfa";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { explainMistake } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/mistakes/$id")({
  head: () => ({ meta: pageMeta("Mistake — SEEFAA", "Review, explain and retry a logged mistake.") }),
  component: MistakeDetail,
});

const ACTIONS = [
  ["simpler", "Explain more simply"], ["calculation", "Show the calculation"], ["compare", "Compare similar concepts"],
  ["example", "Generate another example"], ["quiz", "Quiz me on this concept"],
] as const;

function MistakeDetail() {
  const { id } = Route.useParams();
  const { data: cur } = useCurriculum();
  const inv = useInvalidate();
  const navigate = useNavigate();
  const explain = useServerFn(explainMistake);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["mistake", id],
    queryFn: async () => {
      const { data: m } = await supabase.from("mistakes").select("*").eq("id", id).maybeSingle();
      if (!m) return null;
      const [ex, at, urls, related] = await Promise.all([
        supabase.from("ai_explanations").select("*").eq("mistake_id", id).order("created_at"),
        supabase.from("mistake_attempts").select("*").eq("mistake_id", id).order("created_at", { ascending: false }),
        m.image_paths.length ? supabase.storage.from("mistake-images").createSignedUrls(m.image_paths, 3600) : Promise.resolve({ data: [] }),
        m.module_id ? supabase.from("mistakes").select("id, question, error_category, created_at").eq("module_id", m.module_id).neq("id", id).limit(10) : Promise.resolve({ data: [] }),
      ]);
      return { m, explanations: ex.data ?? [], attempts: at.data ?? [], urls: (urls.data ?? []).map((u: { signedUrl: string | null }) => u.signedUrl).filter(Boolean) as string[], related: related.data ?? [] };
    },
  });
  const [form, setForm] = useState<Record<string, string>>({});
  if (!cur || !data) return <p className="text-muted-foreground">{data === null ? "Mistake not found." : "Loading…"}</p>;
  const { m } = data;
  const choices = (Array.isArray(m.choices) ? m.choices : []) as { label: string; text: string }[];
  const sameCategory = data.related.filter((r) => r.error_category === m.error_category).length;
  const recurring = data.related.length >= 2;

  async function run(mode: "full" | (typeof ACTIONS)[number][0]) {
    setBusy(mode);
    try {
      const res = await explain({ data: { mistakeId: id, mode } });
      if (!res.ok) toast.error(res.error);
      else refetch();
    } finally {
      setBusy(null);
    }
  }
  async function saveEdit() {
    const patch: TablesUpdate<"mistakes"> & Record<string, any> = { ...form, updated_at: new Date().toISOString() };
    if ("correct_answer" in form) patch.correct_verified = false;
    if ("module_id" in form && !form.module_id) patch.module_id = null;
    if ("los_id" in form && !form.los_id) patch.los_id = null;
    const { error } = await supabase.from("mistakes").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    setEditing(false); setForm({}); refetch(); inv("mistakes");
  }
  async function setMastery(mastery: string) {
    await supabase.from("mistakes").update({ mastery }).eq("id", id);
    refetch(); inv("mistakes");
  }
  async function del() {
    if (!confirm("Delete this mistake, its screenshots and explanations permanently?")) return;
    if (m.image_paths.length) await supabase.storage.from("mistake-images").remove(m.image_paths);
    await supabase.from("mistakes").delete().eq("id", id);
    inv("mistakes");
    navigate({ to: "/mistakes" });
  }
  const val = (k: keyof typeof m) => (k in form ? form[k as string] : (m[k] as string | null) ?? "");

  if (retry) return <div className="mx-auto max-w-2xl"><QuizRunner items={[m]} onDone={() => { setRetry(false); refetch(); }} /></div>;

  return (
    <div className="space-y-5">
      <Link to="/mistakes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Mistake Bank</Link>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-secondary px-2.5 py-1">{cur.subject(m.subject_id)?.name}</span>
        {m.module_id && <span className="rounded-full bg-muted px-2.5 py-1">{cur.module(m.module_id)?.title}</span>}
        <span className="rounded-full bg-muted px-2.5 py-1">{categoryLabel(m.error_category)}</span>
        <span className="rounded-full bg-sun/30 px-2.5 py-1">Next review {fmtDate(m.next_review)}</span>
        {m.source === "ai" && <span className="rounded-full bg-primary/15 px-2.5 py-1">AI-generated question</span>}
      </div>
      <header className="max-w-3xl border-l-4 border-primary pl-4 sm:pl-5">
        <p className="mb-2 text-[11px] font-bold uppercase text-primary">Logged question · {fmtDate(m.created_at)}</p>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{m.concept || "Question review"}</h1>
      </header>
      {recurring && (
        <div className="flex gap-2 rounded-xl border border-sun bg-sun/20 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div><b>Recurring weakness:</b> you have {data.related.length} other mistakes in this module{sameCategory ? `, ${sameCategory} with the same error type` : ""}.
            <ul className="mt-1 list-disc pl-5 text-xs">{data.related.slice(0, 3).map((r) => <li key={r.id}><Link to="/mistakes/$id" params={{ id: r.id }} className="underline">{r.question.slice(0, 80)}…</Link></li>)}</ul></div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Panel title="Question" action={<Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</Button>}>
            {editing ? (
              <div className="space-y-3">
                <Textarea rows={6} value={val("question")} onChange={(e) => setForm({ ...form, question: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Your answer</Label><Input value={val("selected_answer")} onChange={(e) => setForm({ ...form, selected_answer: e.target.value })} /></div>
                  <div><Label className="text-xs">Correct answer</Label><Input value={val("correct_answer")} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} /></div>
                </div>
                <Input placeholder="Concept" value={val("concept")} onChange={(e) => setForm({ ...form, concept: e.target.value })} />
                <NativeSelect value={val("module_id")} onChange={(e) => setForm({ ...form, module_id: e.target.value })}>
                  <option value="">No module</option>{cur.modulesOf(m.subject_id).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </NativeSelect>
                {cur.los.some((l) => l.module_id === (val("module_id") || m.module_id)) && (
                  <NativeSelect value={val("los_id")} onChange={(e) => setForm({ ...form, los_id: e.target.value })}>
                    <option value="">No LOS</option>{cur.los.filter((l) => l.module_id === (val("module_id") || m.module_id)).map((l) => <option key={l.id} value={l.id}>{l.code} {l.statement}</option>)}
                  </NativeSelect>
                )}
                <NativeSelect value={val("error_category")} onChange={(e) => setForm({ ...form, error_category: e.target.value })}>{ERROR_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</NativeSelect>
                <Textarea placeholder="Notes" value={val("notes")} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <Button onClick={saveEdit}>Save changes</Button>
              </div>
            ) : (
              <>
                <article className="question-reading rounded-lg border border-border bg-card p-4 sm:p-6">
                  <QuestionText text={m.question} />
                </article>
                {choices.length > 0 && <div className="mt-5 space-y-3"><p className="text-[11px] font-bold uppercase text-muted-foreground">Answer choices</p>{choices.map((c) => <AnswerChoice key={c.label} label={c.label} text={c.text} state={m.correct_verified && c.label === m.correct_answer ? "correct" : c.label === m.selected_answer ? "selected" : "default"} />)}</div>}
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="border-l-4 border-primary bg-accent/40 p-4"><p className="mb-2 text-xs font-semibold text-muted-foreground">Your answer</p><p className="break-words font-display text-lg font-bold">{m.selected_answer ?? "Not recorded"}</p>{choices.find((c) => c.label === m.selected_answer) && <p className="mt-2 text-sm leading-6">{choices.find((c) => c.label === m.selected_answer)?.text}</p>}</div>
                  <div className="border-l-4 border-info bg-info/5 p-4"><p className="mb-2 text-xs font-semibold text-muted-foreground">Recorded correct answer</p><p className="break-words font-display text-lg font-bold">{m.correct_answer ?? "Not recorded"}</p>{choices.find((c) => c.label === m.correct_answer) && <p className="mt-2 text-sm leading-6">{choices.find((c) => c.label === m.correct_answer)?.text}</p>}{m.correct_answer && <p className="mt-2 text-xs font-semibold text-info">{m.correct_verified ? "✓ Verified" : "Unverified"}</p>}</div>
                </div>
                {m.notes && <div className="mt-5 border-t pt-4"><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Your notes</p><QuestionText text={m.notes} /></div>}
              </>
            )}
          </Panel>
          {data.urls.length > 0 && (
            <Panel title="Screenshots"><div className="space-y-2">{data.urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Original screenshot" className="w-full rounded-lg border" /></a>)}</div></Panel>
          )}
          <Panel title="Practice history">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setRetry(true)}>Retry now</Button>
              <Button size="sm" variant="outline" onClick={() => setMastery(m.mastery === "mastered" ? "learning" : "mastered")}>{m.mastery === "mastered" ? "Needs more practice" : "Mark mastered"}</Button>
            </div>
            <p className="text-sm text-muted-foreground">{m.correct_count} correct of {m.attempts_count} attempts · logged {fmtDate(m.created_at)}</p>
            <ul className="mt-2 space-y-1 text-xs">{data.attempts.map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} — {a.is_correct ? "✓ correct" : "✗ wrong"}{a.answer ? ` (${a.answer})` : ""}</li>)}</ul>
            <Button size="sm" variant="ghost" className="mt-4 text-destructive" onClick={del}><Trash2 className="mr-1 h-4 w-4" /> Delete mistake</Button>
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="AI tutor">
            {!data.explanations.length ? (
              <div className="py-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Get a step-by-step explanation, calculator keystrokes, exam traps and a fresh practice question.</p>
                <Button className="mt-4" size="lg" onClick={() => run("full")} disabled={!!busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Explain My Mistake</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {data.explanations.map((e) => (
                  <div key={e.id} className="border-b pb-5 last:border-0">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary">{e.mode === "full" ? "Explanation" : ACTIONS.find((a) => a[0] === e.mode)?.[1]} · {new Date(e.created_at).toLocaleDateString()}</p>
                    <Markdown>{e.content}</Markdown>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map(([k, l]) => <Button key={k} size="sm" variant="secondary" onClick={() => run(k)} disabled={!!busy}>{busy === k && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{l}</Button>)}
                  <Button size="sm" onClick={() => setMastery("learning").then(() => toast.success("Great — it'll come back for spaced review."))}>I understand now</Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
