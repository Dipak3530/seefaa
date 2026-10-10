import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, Square, BookOpen, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { activeSeconds, fmtHMS } from "@/lib/cfa";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { NativeSelect } from "./bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function useOpenTimer() {
  return useQuery({
    queryKey: ["timer-open"],
    queryFn: async () => {
      const { data } = await supabase.from("timer_sessions").select("*").neq("status", "finished").maybeSingle();
      return data;
    },
  });
}

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function TimerStartButtons() {
  const { data: open } = useOpenTimer();
  const { data: attempt } = useAttempt();
  const { data: cur } = useCurriculum();
  const inv = useInvalidate();
  const [subject, setSubject] = useState("");
  const [module, setModule] = useState("");

  async function start(kind: "study" | "revision") {
    if (open) {
      toast.warning("A session is already active. Pause or finish it first.");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("timer_sessions").insert({
      user_id: u.user!.id,
      attempt_id: attempt?.id ?? null,
      kind,
      subject_id: subject || null,
      module_id: module || null,
    });
    if (error) toast.error(error.message.includes("one_open_timer") ? "Another session is already running." : error.message);
    inv("timer-open", "dashboard");
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <NativeSelect value={subject} onChange={(e) => { setSubject(e.target.value); setModule(""); }} aria-label="Subject (optional)">
          <option value="">Subject (optional)</option>
          {cur?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
        <NativeSelect value={module} onChange={(e) => setModule(e.target.value)} disabled={!subject} aria-label="Module (optional)">
          <option value="">Module (optional)</option>
          {cur?.modulesOf(subject).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-14 text-base" onClick={() => start("study")} disabled={!!open}>
          <BookOpen className="mr-2 h-5 w-5" /> Start Studying
        </Button>
        <Button size="lg" className="h-14 bg-sun text-sun-foreground text-base hover:bg-sun/85" onClick={() => start("revision")} disabled={!!open}>
          <RotateCcw className="mr-2 h-5 w-5" /> Start Revision
        </Button>
      </div>
    </div>
  );
}

/** Compact panel visible on every page while a session is open. */
export function TimerPanel() {
  const { data: s } = useOpenTimer();
  const inv = useInvalidate();
  const now = useTick(!!s && s.status === "running");
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState("");
  if (!s) return null;
  const secs = activeSeconds(s, now);

  async function act(action: "pause" | "resume" | "finish") {
    const { error } = await supabase.rpc("timer_action", { _id: s!.id, _action: action, _notes: action === "finish" ? notes || undefined : undefined });
    if (error) return toast.error(error.message);
    if (action === "finish") {
      toast.success(`Saved ${fmtHMS(secs)} of ${s!.kind === "study" ? "study" : "revision"} time`);
      setFinishing(false);
      setNotes("");
    }
    inv("timer-open", "dashboard", "analytics");
  }
  async function discard() {
    if (!confirm("Discard this session? The recorded time will not be saved.")) return;
    await supabase.from("timer_sessions").delete().eq("id", s!.id);
    inv("timer-open", "dashboard");
  }

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg md:bottom-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {s.kind === "study" ? "Studying" : "Revision"} {s.status === "paused" && "· paused"}
          </p>
          <p className="font-display text-xl font-semibold tabular-nums text-deep" aria-live="off">{fmtHMS(secs)}</p>
        </div>
        {s.status === "running" ? (
          <Button size="icon" variant="secondary" onClick={() => act("pause")} aria-label="Pause"><Pause className="h-4 w-4" /></Button>
        ) : (
          <Button size="icon" variant="secondary" onClick={() => act("resume")} aria-label="Resume"><Play className="h-4 w-4" /></Button>
        )}
        <Button size="icon" onClick={() => setFinishing(true)} aria-label="Finish session"><Square className="h-4 w-4" /></Button>
      </div>
      <Dialog open={finishing} onOpenChange={setFinishing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finish session · {fmtHMS(secs)}</DialogTitle></DialogHeader>
          <Textarea placeholder="Optional notes about this session" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="text-xs text-muted-foreground">Timer time never marks modules as complete — update your progress in the curriculum.</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="text-destructive" onClick={discard}><Trash2 className="mr-1 h-4 w-4" /> Discard</Button>
            <Button onClick={() => act("finish")}>Save session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
