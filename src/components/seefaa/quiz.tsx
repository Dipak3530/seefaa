import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";
import { useInvalidate } from "@/hooks/use-seefaa";
import { cn } from "@/lib/utils";
import { AnswerChoice, QuestionText } from "@/components/seefaa/question";

type M = Tables<"mistakes">;
const norm = (s?: string | null) => (s ?? "").trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");

export function QuizRunner({ items, onDone }: { items: M[]; onDone: () => void }) {
  const inv = useInvalidate();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const m = items[i];
  if (!m) {
    return (
      <div className="card-soft p-8 text-center">
        <p className="font-display text-2xl font-semibold">Session complete</p>
        <p className="mt-2 text-muted-foreground">{score.right} of {score.total} correct. Review intervals were updated.</p>
        <Button className="mt-4" onClick={onDone}>Done</Button>
      </div>
    );
  }
  const choices = (Array.isArray(m.choices) ? m.choices : []) as { label: string; text: string }[];
  const known = !!m.correct_answer;
  const isRight = known && norm(answer) === norm(m.correct_answer);

  async function record(correct: boolean) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("mistake_attempts").insert({ user_id: u.user.id, mistake_id: m.id, answer: answer || null, is_correct: correct });
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    inv("mistakes", "xp", "revision", "dashboard");
    setI(i + 1);
    setAnswer("");
    setRevealed(false);
  }

  return (
    <div className="card-soft p-4 sm:p-6">
      <p className="mb-5 border-b pb-3 text-xs font-bold uppercase text-primary">Question {i + 1} of {items.length}</p>
      <QuestionText text={m.question} />
      {choices.length ? (
        <div className="mt-4 space-y-2">
          {choices.map((c) => (
            <AnswerChoice key={c.label} label={c.label} text={c.text} disabled={revealed} onSelect={() => setAnswer(c.label)} state={revealed && known && norm(c.label) === norm(m.correct_answer) ? "correct" : revealed && known && answer === c.label && !isRight ? "incorrect" : answer === c.label ? "selected" : "default"} />
          ))}
        </div>
      ) : (
        <Input className="mt-4" placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={revealed} />
      )}
      {!revealed ? (
        <Button className="mt-4" onClick={() => setRevealed(true)} disabled={!answer}>Submit answer</Button>
      ) : known ? (
        <div className="mt-4 space-y-3">
          <p className={cn("flex items-center gap-2 font-medium", isRight ? "text-success" : "text-destructive")}>
            {isRight ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {isRight ? "Correct!" : `Not quite — the recorded answer is ${m.correct_answer}${m.correct_verified ? "" : " (unverified)"}.`}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => record(isRight)}>Next</Button>
            <Button asChild variant="ghost"><Link to="/mistakes/$id" params={{ id: m.id }}>Open explanation</Link></Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">No verified correct answer is saved for this question, so SEEFAA won't guess. How did you do?</p>
          <div className="flex gap-2"><Button onClick={() => record(true)}>I got it right</Button><Button variant="outline" onClick={() => record(false)}>I got it wrong</Button></div>
        </div>
      )}
    </div>
  );
}
