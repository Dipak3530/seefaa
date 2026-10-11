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
  const [starting, setStarting] = useState<"study" | "revision" | null>(null);

  async function start(kind: "study" | "revision") {
    if (open) {
      toast.warning("A session is already active. Pause or finish it first.");
      return;
    }
    if (starting) return;
    setStarting(kind);
    try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Please sign in again to start a session."); return; }
    const { error } = await supabase.from("timer_sessions").insert({
      user_id: u.user.id,
      attempt_id: attempt?.id ?? null,
      kind,
      subject_id: subject || null,
      module_id: module || null,
    });
    if (error) toast.error(error.message.includes("one_open_timer") ? "Another session is already running." : error.message);
    inv("timer-open", "dashboard");
    } finally { setStarting(null); }
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
        <Button size="lg" className="h-12 min-w-0 px-2 text-xs sm:text-sm" onClick={() => start("study")} disabled={!!open || !!starting} loading={starting === "study"}>
          <BookOpen className="h-4 w-4" /> Study Timer
        </Button>
        <Button size="lg" variant="info" className="h-12 min-w-0 px-2 text-xs sm:text-sm" onClick={() => start("revision")} disabled={!!open || !!starting} loading={starting === "revision"}>
          <RotateCcw className="h-4 w-4" /> Revision Timer
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
    if (!s) return;
    const { error } = await supabase.rpc("timer_action", { _id: s.id, _action: action, ...(action === "finish" && notes ? { _notes: notes } : {}) });
    if (error) return toast.error(error.message);
    if (action === "finish") {
      toast.success(`Saved ${fmtHMS(secs)} of ${s.kind === "study" ? "study" : "revision"} time`);
      setFinishing(false);
      setNotes("");
    }
    inv("timer-open", "dashboard", "analytics");
  }
  async function discard() {
    if (!s) return;
    if (!confirm("Discard this session? The recorded time will not be saved.")) return;
    await supabase.from("timer_sessions").delete().eq("id", s.id);
    inv("timer-open", "dashboard");
  }

  return (
    <>
      <div className="editorial-shadow fixed bottom-20 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-foreground bg-card px-4 py-3 xl:bottom-6">
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
