import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQuestionMarkdown } from "@/lib/question-format";

export function QuestionText({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={cn("question-prose min-w-0 text-sm leading-7", compact && "max-h-56 overflow-hidden")}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      table: ({ children }) => <div className="question-table"><table>{children}</table></div>,
    }}>{formatQuestionMarkdown(text)}</ReactMarkdown>
  </div>;
}

export function AnswerChoice({ label, text, state = "default", onSelect, disabled }: {
  label: string; text: string; state?: "default" | "selected" | "correct" | "incorrect";
  onSelect?: () => void; disabled?: boolean;
}) {
  const content = <>
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md border font-display text-sm font-bold", state === "correct" ? "border-info bg-info text-info-foreground" : state === "selected" || state === "incorrect" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground")}>{label.replace(/[.)]$/, "")}</span>
    <span className="min-w-0 flex-1"><QuestionText text={text} />{!onSelect && state !== "default" && <span className={cn("mt-2 block text-xs font-bold", state === "correct" ? "text-info" : "text-primary")}>{state === "correct" ? "Verified correct answer" : "Your answer"}</span>}</span>
    {state === "correct" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : state === "incorrect" ? <XCircle className="h-5 w-5 shrink-0" /> : onSelect ? <Circle className={cn("h-4 w-4 shrink-0", state === "selected" && "fill-primary text-primary")} /> : null}
  </>;
  const className = cn("question-choice flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left text-foreground sm:p-4",
    state === "selected" && "border-primary bg-accent/35",
    state === "correct" && "border-info bg-info/5 text-info",
    state === "incorrect" && "border-destructive bg-destructive/5");
  return onSelect ? <Button variant="outline" onClick={onSelect} disabled={disabled} aria-pressed={state === "selected"} className={cn(className, "h-auto justify-start whitespace-normal")}>{content}</Button> : <div className={className}>{content}</div>;
}