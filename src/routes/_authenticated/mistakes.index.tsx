import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Library, Play, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Empty, NativeSelect } from "@/components/seefaa/bits";
import { QuizRunner } from "@/components/seefaa/quiz";
import { useCurriculum } from "@/hooks/use-seefaa";
import { ERROR_CATEGORIES, categoryLabel, fmtDate } from "@/lib/cfa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mistakes/")({
  head: () => ({ meta: pageMeta("My Mistake Bank — SEEFAA", "Your private bank of questions to practise.") }),
  component: Bank,
});

function Bank() {
  const { data: cur } = useCurriculum();
  const [subject, setSubject] = useState("");
  const [module, setModule] = useState("");
  const [cat, setCat] = useState("");
  const [mastery, setMastery] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [quiz, setQuiz] = useState(false);
  const { data: all, refetch } = useQuery({
    queryKey: ["mistakes"],
    queryFn: async () => (await supabase.from("mistakes").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  if (!cur) return null;
  const list = (all ?? []).filter((m) =>
    (!subject || m.subject_id === subject) && (!module || m.module_id === module) && (!cat || m.error_category === cat) &&
    (!mastery || m.mastery === mastery) && (!source || m.source === source) &&
    (!q || `${m.question} ${m.concept ?? ""} ${m.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  function exportCsv() {
    const rows = [["date", "subject", "module", "concept", "category", "question", "your_answer", "correct_answer", "attempts", "correct", "mastery"],
      ...list.map((m) => [m.created_at, cur!.subject(m.subject_id)?.name ?? "", cur!.module(m.module_id)?.title ?? "", m.concept ?? "", categoryLabel(m.error_category), m.question, m.selected_answer ?? "", m.correct_answer ?? "", m.attempts_count, m.correct_count, m.mastery])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "seefaa-mistakes.csv";
    a.click();
  }

  if (quiz) return <div className="mx-auto max-w-2xl"><QuizRunner items={list.slice(0, 20)} onDone={() => { setQuiz(false); refetch(); }} /></div>;

  return (
    <div>
      <PageHeader title="My Mistake Bank" subtitle="Every question you've logged — private, searchable, and ready to practise."
        actions={<>
          <Button variant="outline" onClick={exportCsv} disabled={!list.length}><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button onClick={() => setQuiz(true)} disabled={!list.length}><Play className="mr-2 h-4 w-4" />Quiz me ({Math.min(20, list.length)})</Button>
        </>} />
      <div className="mb-6 grid gap-2 border-y py-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative sm:col-span-3 lg:col-span-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <NativeSelect value={subject} onChange={(e) => { setSubject(e.target.value); setModule(""); }}><option value="">All subjects</option>{cur.subjects.map((s) => <option key={s.id} value={s.id}>{s.short_name}</option>)}</NativeSelect>
        <NativeSelect value={module} onChange={(e) => setModule(e.target.value)} disabled={!subject}><option value="">All modules</option>{cur.modulesOf(subject).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</NativeSelect>
        <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All error types</option>{ERROR_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</NativeSelect>
        <NativeSelect value={mastery} onChange={(e) => setMastery(e.target.value)}><option value="">Any mastery</option><option value="new">New</option><option value="learning">Needs practice</option><option value="mastered">Mastered</option></NativeSelect>
        <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option><option value="uploaded">My questions</option><option value="ai">AI-generated</option></NativeSelect>
      </div>
      {!list.length ? (
        <Empty icon={<Library className="h-8 w-8" />} title={all?.length ? "No mistakes match these filters" : "Your bank is empty"} body="Log a question you got wrong and it appears here automatically."
          action={<Button asChild><Link to="/error-log">Log a Mistake</Link></Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((m) => (
            <Link key={m.id} to="/mistakes/$id" params={{ id: m.id }} className="card-soft block p-4 transition hover:-translate-y-0.5">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md bg-secondary px-2 py-1">{cur.subject(m.subject_id)?.short_name}</span>
                <span className="rounded-md bg-muted px-2 py-1">{categoryLabel(m.error_category)}</span>
                <span className={cn("rounded-md px-2 py-1", m.mastery === "mastered" ? "bg-primary text-primary-foreground" : "bg-background")}>{m.mastery === "mastered" ? "Mastered" : m.mastery === "new" ? "New" : "Needs practice"}</span>
                {m.source === "ai" && <span className="rounded-full bg-primary/15 px-2 py-0.5">AI-generated</span>}
              </div>
              <p className="line-clamp-3 text-sm">{m.question}</p>
              <p className="mt-2 text-xs text-muted-foreground">{fmtDate(m.created_at)} · {m.correct_count}/{m.attempts_count} correct · review {fmtDate(m.next_review)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
