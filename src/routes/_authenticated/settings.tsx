import { pageMeta } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate, useProfile } from "@/hooks/use-seefaa";
import { WEEKDAYS, fmtDate, ETHICS_ID } from "@/lib/cfa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: pageMeta("Profile & Settings — SEEFAA", "Exam attempts, study preferences, reminders and your data.") }),
  component: Settings,
});

type Reminders = { daily: boolean; revisions: boolean; weekly: boolean; quiet_start: string; quiet_end: string };

function Settings() {
  const { data: profile } = useProfile();
  const { data: attempt } = useAttempt();
  const { data: cur } = useCurriculum();
  const inv = useInvalidate();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [p, setP] = useState<{ display_name: string; hours: number; days: number[]; opt: boolean; tz: string; rem: Reminders } | null>(null);
  const [a, setA] = useState({ exam_date: "", target: "" });
  const [newAttempt, setNewAttempt] = useState(false);
  const [carry, setCarry] = useState({ mistakes: true, formulas: true });
  const [examNew, setExamNew] = useState("");
  const { data: attempts, refetch } = useQuery({ queryKey: ["attempts"], queryFn: async () => (await supabase.from("exam_attempts").select("*").order("created_at")).data ?? [] });

  useEffect(() => {
    if (profile) setP({ display_name: profile.display_name ?? "", hours: Number(profile.hours_per_day), days: profile.study_days, opt: profile.leaderboard_opt_in, tz: profile.timezone, rem: profile.reminders as Reminders });
  }, [profile]);
  useEffect(() => { if (attempt) setA({ exam_date: attempt.exam_date ?? "", target: attempt.target_completion_date ?? "" }); }, [attempt]);
  if (!p || !profile || !attempt || !cur) return <p className="text-muted-foreground">Loading…</p>;

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ display_name: p!.display_name, hours_per_day: p!.hours, study_days: p!.days, leaderboard_opt_in: p!.opt, timezone: p!.tz, reminders: p!.rem }).eq("id", profile!.id);
    if (error) return toast.error(error.message);
    toast.success("Saved. Recalculate your plan to apply new study time."); inv("profile");
  }
  async function saveAttempt() {
    const { error } = await supabase.from("exam_attempts").update({ exam_date: a.exam_date || null, target_completion_date: a.target || null }).eq("id", attempt!.id);
    if (error) return toast.error(error.message);
    toast.success("Exam dates updated"); inv("attempt");
  }
  async function startAttempt() {
    const uid = profile!.id;
    await supabase.from("exam_attempts").update({ is_active: false }).eq("id", attempt!.id);
    const { data: att, error } = await supabase.from("exam_attempts").insert({ user_id: uid, version_id: "2027-L1", exam_date: examNew || null }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("subject_plans").insert(cur!.subjects.map((s, i) => ({ user_id: uid, attempt_id: att.id, subject_id: s.id, status: s.id === ETHICS_ID ? "active" : "not_started", position: s.id === ETHICS_ID ? -1 : i })));
    if (carry.mistakes) {
      // carry forward: link unmastered mistakes to the new attempt; XP history stays with the original attempt
      await supabase.from("mistakes").update({ attempt_id: att.id }).eq("attempt_id", attempt!.id).neq("mastery", "mastered");
    }
    await supabase.from("profiles").update({ active_attempt_id: att.id }).eq("id", uid);
    toast.success("New attempt started. Pick your first subject in My Study Plan.");
    setNewAttempt(false); refetch(); inv("profile", "attempt", "progress");
  }
  async function switchAttempt(id: string) {
    await supabase.from("profiles").update({ active_attempt_id: id }).eq("id", profile!.id);
    inv("profile", "attempt", "progress");
  }
  async function exportAll() {
    const tables = ["profiles", "exam_attempts", "subject_plans", "module_progress", "los_progress", "revision_checkpoints", "study_tasks", "mistakes", "mistake_attempts", "ai_explanations", "practice_sessions", "mock_exams", "formulas", "timer_sessions", "xp_ledger"] as const;
    const out: Record<string, unknown> = {};
    for (const t of tables) out[t] = (await supabase.from(t).select("*")).data;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    link.download = "seefaa-export.json"; link.click();
  }
  async function deleteAll() {
    if (prompt('This permanently deletes all your SEEFAA data. Type DELETE to confirm.') !== "DELETE") return;
    const { data: imgs } = await supabase.from("mistakes").select("image_paths");
    const paths = (imgs ?? []).flatMap((m) => m.image_paths);
    if (paths.length) await supabase.storage.from("mistake-images").remove(paths);
    for (const t of ["timer_sessions", "formulas", "mock_exams", "practice_sessions", "ai_explanations", "mistake_attempts", "mistakes", "ai_usage"] as const) await supabase.from(t).delete().eq("user_id", profile!.id);
    await supabase.from("profiles").update({ active_attempt_id: null, onboarded: false }).eq("id", profile!.id);
    await supabase.from("exam_attempts").delete().eq("user_id", profile!.id);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    toast.success("Your data was deleted.");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Exam attempt">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Exam date</Label><Input type="date" value={a.exam_date} onChange={(e) => setA({ ...a, exam_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>Target completion</Label><Input type="date" value={a.target} onChange={(e) => setA({ ...a, target: e.target.value })} /></div>
            </div>
            <Button onClick={saveAttempt}>Save dates</Button>
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">All attempts</p>
              <ul className="space-y-1 text-sm">{(attempts ?? []).map((x) => (
                <li key={x.id} className={cn("flex items-center justify-between rounded-md px-2 py-1", x.id === attempt.id && "bg-accent")}>
                  <span>{x.label} · exam {fmtDate(x.exam_date)} · started {fmtDate(x.start_date)}</span>
                  {x.id !== attempt.id && <Button size="sm" variant="ghost" onClick={() => switchAttempt(x.id)}>View</Button>}
                </li>
              ))}</ul>
              <Button variant="outline" className="mt-3" onClick={() => setNewAttempt(true)}>Start a new attempt</Button>
            </div>
          </div>
        </Panel>
        <Panel title="Study preferences">
          <div className="space-y-3">
            <div className="space-y-1"><Label>Display name</Label><Input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Hours per study day</Label><Input type="number" step={0.5} min={0.5} max={12} value={p.hours} onChange={(e) => setP({ ...p, hours: Number(e.target.value) })} /></div>
            <div><Label>Study days</Label><div className="mt-1 flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => <button key={d} onClick={() => setP({ ...p, days: p.days.includes(i) ? p.days.filter((x) => x !== i) : [...p.days, i] })} className={cn("rounded-full border px-3 py-1 text-xs", p.days.includes(i) ? "bg-primary text-primary-foreground" : "bg-card")}>{d}</button>)}</div></div>
            <div className="space-y-1"><Label>Time zone</Label><Input value={p.tz} onChange={(e) => setP({ ...p, tz: e.target.value })} /></div>
            <label className="flex items-center justify-between text-sm">Show me on the leaderboard (name + XP only)<Switch checked={p.opt} onCheckedChange={(v) => setP({ ...p, opt: v })} /></label>
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">In-app reminders</p>
              {([["daily", "Daily study tasks"], ["revisions", "Due & overdue revisions"], ["weekly", "Weekly progress summary"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center justify-between text-sm">{l}<Switch checked={p.rem[k]} onCheckedChange={(v) => setP({ ...p, rem: { ...p.rem, [k]: v } })} /></label>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm"><span className="col-span-3 text-xs font-medium">Quiet hours</span><Input type="time" className="min-w-0 w-full" value={p.rem.quiet_start} onChange={(e) => setP({ ...p, rem: { ...p.rem, quiet_start: e.target.value } })} /> to <Input type="time" className="min-w-0 w-full" value={p.rem.quiet_end} onChange={(e) => setP({ ...p, rem: { ...p.rem, quiet_end: e.target.value } })} /></div>
            </div>
            <Button onClick={saveProfile}>Save preferences</Button>
          </div>
        </Panel>
        <Panel title="Your data" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportAll}>Download all my data</Button>
            <Button variant="destructive" onClick={deleteAll}>Delete all my data</Button>
          </div>
        </Panel>
      </div>
      <Dialog open={newAttempt} onOpenChange={setNewAttempt}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start a new exam attempt</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Your current attempt and all its history stay saved. XP already earned is never duplicated.</p>
          <div className="space-y-1"><Label>New exam date</Label><Input type="date" value={examNew} onChange={(e) => setExamNew(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={carry.mistakes} onCheckedChange={(v) => setCarry({ ...carry, mistakes: !!v })} /> Carry forward unmastered mistakes</label>
          <p className="text-xs text-muted-foreground">Formulas and your mistake bank are always available across attempts.</p>
          <DialogFooter><Button onClick={startAttempt}>Start new attempt</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
