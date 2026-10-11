import { pageMeta } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/seefaa/app-shell";
import { useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { WEEKDAYS, ETHICS_ID } from "@/lib/cfa";
import { applyPlan, proposePlan } from "@/lib/plan-actions";
import { saveAiKey } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: pageMeta("Set up your plan — SEEFAA", "A few questions to personalize your CFA Level I plan.") }),
  component: Onboarding,
});

type Status = "not_started" | "partial" | "completed";
const STEPS = ["Welcome", "Exam date", "Your starting point", "Confidence", "Study time", "Schedule", "First subject", "AI key", "Your plan"];

function Onboarding() {
  const { data: cur } = useCurriculum();
  const navigate = useNavigate();
  const inv = useInvalidate();
  const [step, setStep] = useState(0);
  const [examDate, setExamDate] = useState("");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [conf, setConf] = useState<Record<string, string>>({});
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [target, setTarget] = useState("");
  const [first, setFirst] = useState("");
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic" | "gemini">("openai");
  const [aiKey, setAiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!cur) return null;
  const subjects = cur.subjects;
  const pickable = subjects.filter((s) => s.id !== ETHICS_ID && status[s.id] !== "completed");

  async function finish() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const { data: att, error } = await supabase.from("exam_attempts").insert({
        user_id: uid, version_id: "2027-L1", exam_date: examDate || null, target_completion_date: target || null,
      }).select().single();
      if (error) throw error;
      const plans = subjects.map((s, i) => ({
        user_id: uid, attempt_id: att.id, subject_id: s.id, confidence: conf[s.id] ?? null,
        status: status[s.id] === "completed" ? "completed" : s.id === first || s.id === ETHICS_ID ? "active" : "not_started",
        position: s.id === first ? 0 : s.id === ETHICS_ID ? -1 : i + 1,
      }));
      await supabase.from("subject_plans").insert(plans);
      const completedSubjects = subjects.filter((s) => status[s.id] === "completed").map((s) => s.id);
      const mp = cur!.modules.filter((m) => completedSubjects.includes(m.subject_id)).map((m) => ({
        user_id: uid, attempt_id: att.id, module_id: m.id, status: "completed",
      }));
      if (mp.length) await supabase.from("module_progress").insert(mp);
      await supabase.from("profiles").update({ hours_per_day: hours, study_days: days, onboarded: true, active_attempt_id: att.id, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq("id", uid);
      const tasks = proposePlan({ cur: cur!, prog: { modules: mp.map((m) => ({ module_id: m.module_id, status: "completed" })), plans }, studyDays: days, hoursPerDay: hours, examDate: examDate || null });
      await applyPlan(uid, att.id, tasks);
      await inv("profile", "attempt", "progress");
      toast.success("Your plan is ready — Ethics is included from day one.");
      navigate({ to: "/dashboard", search: { welcome: true } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create your plan");
    } finally {
      setBusy(false);
    }
  }

  async function connectKey() {
    setKeyBusy(true);
    try {
      const r = await saveAiKey({ data: { provider: aiProvider, apiKey: aiKey.trim() } });
      if (!r.ok) return toast.error(r.error);
      setKeySaved(true);
      toast.success("AI key verified and saved securely.");
    } finally {
      setKeyBusy(false);
    }
  }

  const canNext = (step !== 6 || !!first) && (step !== 7 || keySaved);
  return (
    <div className="sky-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <div className="mt-6 flex gap-1">{STEPS.map((s, i) => <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-card")} />)}</div>
        <div className="card-soft mt-6 p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
          {step === 0 && (
            <div className="mt-3 space-y-3">
              <h1 className="text-3xl font-semibold">Welcome to SEEFAA</h1>
              <p className="text-muted-foreground">A few quick questions and we'll build a CFA Level I plan around your life. You can change every answer later.</p>
            </div>
          )}
          {step === 1 && (
            <div className="mt-3 space-y-4">
              <h2 className="text-2xl font-semibold">When is your Level I exam?</h2>
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              <p className="text-sm text-muted-foreground">Not booked yet? Leave it empty — you can add it later.</p>
            </div>
          )}
          {step === 2 && (
            <div className="mt-3 space-y-3">
              <h2 className="text-2xl font-semibold">Where are you starting from?</h2>
              {subjects.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Segmented value={status[s.id] ?? "not_started"} onChange={(v) => setStatus({ ...status, [s.id]: v as Status })}
                    options={[["not_started", "Not started"], ["partial", "Partly"], ["completed", "Done"]]} />
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="mt-3 space-y-3">
              <h2 className="text-2xl font-semibold">How confident do you feel?</h2>
              <p className="text-sm text-muted-foreground">Optional — skip any you're unsure about.</p>
              {subjects.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Segmented value={conf[s.id] ?? ""} onChange={(v) => setConf({ ...conf, [s.id]: v })} options={[["low", "Low"], ["medium", "Medium"], ["high", "High"]]} />
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="mt-3 space-y-4">
              <h2 className="text-2xl font-semibold">How many hours can you study per day?</h2>
              <div className="flex items-center gap-3"><Input type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-28" /> hours on study days</div>
            </div>
          )}
          {step === 5 && (
            <div className="mt-3 space-y-4">
              <h2 className="text-2xl font-semibold">Study days and target</h2>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d, i) => (
                  <Button variant={days.includes(i) ? "default" : "outline"} size="sm" aria-pressed={days.includes(i)} key={d} type="button" onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
                    className={cn("rounded-full border px-4 py-1.5 text-sm", days.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>{d}</Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Unselected days are break days — no tasks, no penalties.</p>
              <div className="space-y-1.5"><Label>Target syllabus completion date (optional)</Label><Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            </div>
          )}
          {step === 6 && (
            <div className="mt-3 space-y-4">
              <h2 className="text-2xl font-semibold">Which subject do you want to start with?</h2>
              <p className="text-sm text-muted-foreground">Just one for now — pick the next whenever you're ready. Ethics runs alongside automatically.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {pickable.map((s) => (
                  <Button variant={first === s.id ? "secondary" : "outline"} aria-pressed={first === s.id} key={s.id} type="button" onClick={() => setFirst(s.id)}
                    className={cn("h-auto justify-start whitespace-normal rounded-lg p-4 text-left text-sm", first === s.id ? "border-primary bg-accent ring-2 ring-primary" : "bg-card hover:bg-muted")}>{s.name}</Button>
                ))}
              </div>
            </div>
          )}
          {step === 7 && (
            <div className="mt-3 space-y-4">
              <h2 className="text-2xl font-semibold">Connect your AI key</h2>
              <p className="text-sm text-muted-foreground">
                SEEFAA uses your own AI key for screenshot extraction and explanations — your usage, your bill, your privacy. The key is stored encrypted and never shown again.
              </p>
              <div className="flex flex-wrap gap-2">
                {([["openai", "OpenAI"], ["anthropic", "Anthropic"], ["gemini", "Google Gemini"]] as const).map(([v, l]) => (
                  <Button key={v} type="button" size="sm" variant={aiProvider === v ? "default" : "outline"} aria-pressed={aiProvider === v}
                    onClick={() => { setAiProvider(v); setKeySaved(false); }}
                    className={cn("rounded-full border px-4 py-1.5 text-sm", aiProvider === v ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>{l}</Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>{aiProvider === "openai" ? "OpenAI API key" : aiProvider === "anthropic" ? "Anthropic API key" : "Gemini API key"}</Label>
                <Input type="password" value={aiKey} onChange={(e) => { setAiKey(e.target.value); setKeySaved(false); }}
                  placeholder={aiProvider === "openai" ? "sk-..." : aiProvider === "anthropic" ? "sk-ant-..." : "AIza..."} />
                <p className="text-xs text-muted-foreground">
                  {aiProvider === "openai" && "Get one at platform.openai.com → API keys."}
                  {aiProvider === "anthropic" && "Get one at console.anthropic.com → API keys."}
                  {aiProvider === "gemini" && "Get one free at aistudio.google.com → Get API key."}
                </p>
              </div>
              <Button type="button" variant={keySaved ? "secondary" : "default"} loading={keyBusy} disabled={aiKey.trim().length < 10 || keySaved} onClick={connectKey}>
                {keySaved ? "✓ Key connected" : keyBusy ? "Verifying…" : "Verify & connect"}
              </Button>
            </div>
          )}
          {step === 8 && (
            <div className="mt-3 space-y-3">
              <h2 className="text-2xl font-semibold">Ready to build your plan</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Daily tasks for {cur.subject(first)?.name} plus a 30-minute Ethics session from day one.</li>
                <li><b>Log a Mistake</b> from the dashboard: paste a screenshot and SEEFAA reads it for you.</li>
                <li>Mark modules complete in <b>CFA Curriculum</b> — R1–R5 revision checkpoints are scheduled automatically.</li>
                <li>The <b>Revision Centre</b> shows what's due each day.</li>
              </ul>
            </div>
          )}
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Button loading={busy} onClick={finish}>{busy ? "Building…" : "Create my plan"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <Button variant={value === v ? "secondary" : "outline"} size="sm" aria-pressed={value === v} key={v} type="button" onClick={() => onChange(value === v ? "" : v)}
          className={cn("rounded-md px-3 py-1 text-xs font-medium", value === v ? "bg-card text-deep shadow-sm" : "text-muted-foreground")}>{l}</Button>
      ))}
    </div>
  );
}
