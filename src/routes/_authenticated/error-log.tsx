import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Plus, ScanText, Trash2, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Panel, NativeSelect } from "@/components/seefaa/bits";
import { useAttempt, useCurriculum, useInvalidate } from "@/hooks/use-seefaa";
import { ERROR_CATEGORIES } from "@/lib/cfa";
import { extractQuestion } from "@/server/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/error-log")({
  head: () => ({ meta: [{ title: "Error Log — SEEFAA" }, { name: "description", content: "Paste a screenshot of a question you got wrong." }] }),
  component: ErrorLog,
});

type Img = { id: string; dataUrl: string; blob: Blob };
type Choice = { label: string; text: string };
const MAX_FILE = 10 * 1024 * 1024;
const MAX_IMAGES = 4;

async function compress(file: File): Promise<Img> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { id: crypto.randomUUID(), dataUrl, blob };
}
async function hashBlob(b: Blob) {
  const buf = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function ErrorLog() {
  const { data: cur } = useCurriculum();
  const { data: attempt } = useAttempt();
  const navigate = useNavigate();
  const inv = useInvalidate();
  const extract = useServerFn(extractQuestion);
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<Img[]>([]);
  const [drag, setDrag] = useState(false);
  const [subject, setSubject] = useState("");
  const [module, setModule] = useState("");
  const [modFilter, setModFilter] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [extracted, setExtracted] = useState(false);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState("");
  const [correct, setCorrect] = useState("");
  const [verified, setVerified] = useState(false);
  const [concept, setConcept] = useState("");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dupe, setDupe] = useState<{ id: string; question: string } | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const ok = files.filter((f) => {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name || "File"} isn't an image. Use PNG, JPG or WebP.`); return false; }
      if (f.size > MAX_FILE) { toast.error("That image is over 10 MB."); return false; }
      return true;
    });
    const room = MAX_IMAGES - images.length;
    if (ok.length > room) toast.warning(`Up to ${MAX_IMAGES} screenshots per question.`);
    try {
      const imgs = await Promise.all(ok.slice(0, Math.max(0, room)).map(compress));
      setImages((p) => [...p, ...imgs]);
    } catch {
      toast.error("Couldn't read that image.");
    }
  }, [images.length]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addFiles(files); }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  if (!cur) return <p className="text-muted-foreground">Loading…</p>;
  const modules = cur.modulesOf(subject).filter((m) => m.title.toLowerCase().includes(modFilter.toLowerCase()));
  const losOptions = cur.los.filter((l) => l.module_id === module);

  async function runExtract() {
    if (!images.length) return;
    setExtracting(true);
    try {
      const res = await extract({ data: { images: images.map((i) => i.dataUrl), moduleTitles: cur!.modulesOf(subject).map((m) => m.title) } });
      if (!res.ok) { toast.error(res.error); setIssues([res.error, "You can still type the question in manually below."]); setExtracted(true); return; }
      const r = res.result;
      setQuestion(r.question ?? "");
      setChoices(r.choices ?? []);
      setSelected(r.selected_answer ?? "");
      setCorrect(r.correct_answer ?? "");
      setVerified(false);
      setConcept(r.concept ?? "");
      if (r.suggested_error_category) setCategory(r.suggested_error_category);
      if (!subject && r.suggested_subject_id) setSubject(r.suggested_subject_id);
      const sid = subject || r.suggested_subject_id;
      if (!module && r.suggested_module_title && sid) {
        const hit = cur!.modulesOf(sid).find((m) => m.title.toLowerCase() === String(r.suggested_module_title).toLowerCase());
        if (hit) setModule(hit.id);
      }
      const iss = [...(r.issues ?? [])];
      if (!r.legible) iss.unshift("The screenshot was hard to read — please check every field.");
      if (!r.question) iss.push("Question text is missing — type it in.");
      if (!r.correct_answer) iss.push("Correct answer not shown in the screenshot — add it if you know it.");
      if (r.suggested_subject_id && !subject) iss.push("Subject was suggested by AI — please confirm.");
      setIssues(iss);
      setExtracted(true);
    } finally {
      setExtracting(false);
    }
  }

  async function checkDuplicate(hash: string | null) {
    const q = supabase.from("mistakes").select("id, question").limit(1);
    if (hash) {
      const { data } = await q.eq("image_hash", hash);
      if (data?.[0]) return data[0];
    }
    if (question.length > 30) {
      const { data } = await supabase.from("mistakes").select("id, question").ilike("question", `${question.slice(0, 60).replace(/[%_]/g, "")}%`).limit(1);
      if (data?.[0]) return data[0];
    }
    return null;
  }

  async function save(force = false) {
    if (!subject) return toast.error("Choose a subject.");
    if (!question.trim()) return toast.error("Add the question text.");
    setSaving(true);
    try {
      const hash = images[0] ? await hashBlob(images[0].blob) : null;
      if (!force) {
        const d = await checkDuplicate(hash);
        if (d) { setDupe(d); return; }
      }
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const paths: string[] = [];
      for (const img of images) {
        const path = `${uid}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("mistake-images").upload(path, img.blob, { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      const { data, error } = await supabase.from("mistakes").insert({
        user_id: uid, attempt_id: attempt?.id ?? null, version_id: attempt?.version_id ?? "2027-L1",
        subject_id: subject, module_id: module || null, question: question.trim(), choices: choices.filter((c) => c.text.trim()),
        selected_answer: selected || null, correct_answer: correct || null, correct_verified: !!correct && verified,
        concept: concept || null, notes: notes || null, error_category: category, image_paths: paths, image_hash: hash,
      }).select("id").single();
      if (error) throw error;
      toast.success("Saved to your Mistake Bank");
      inv("mistakes", "dashboard");
      navigate({ to: "/mistakes/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function linkToExisting() {
    if (!dupe) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("mistake_attempts").insert({ user_id: u.user!.id, mistake_id: dupe.id, answer: selected || null, is_correct: false });
    toast.success("Recorded as a new attempt on your existing mistake");
    navigate({ to: "/mistakes/$id", params: { id: dupe.id } });
  }

  return (
    <div>
      <PageHeader title="Error Log" subtitle="Got one wrong? Capture it in seconds. Everything stays private to you." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]); }}
            onClick={() => fileRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card p-8 text-center transition", drag ? "border-primary bg-accent" : "border-primary/40 hover:border-primary")}
          >
            <ImagePlus className="h-10 w-10 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold">Paste, drop or upload</p>
            <p className="mt-1 text-sm text-muted-foreground">Press <kbd className="rounded border bg-muted px-1">Ctrl/Cmd</kbd> + <kbd className="rounded border bg-muted px-1">V</kbd> anywhere on this page. Up to {MAX_IMAGES} screenshots, 10 MB each.</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple capture="environment" className="hidden" onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img, i) => (
                <div key={img.id} className="relative overflow-hidden rounded-xl border bg-card">
                  <img src={img.dataUrl} alt={`Screenshot ${i + 1}`} className="h-36 w-full object-contain" />
                  <button onClick={() => setImages(images.filter((x) => x.id !== img.id))} className="absolute right-1 top-1 rounded-full bg-card p-1 shadow" aria-label="Remove image"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <Panel>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Subject</Label>
                <NativeSelect value={subject} onChange={(e) => { setSubject(e.target.value); setModule(""); }}>
                  <option value="">Choose subject…</option>
                  {cur.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5"><Label>Module</Label>
                <Input placeholder="Search modules…" value={modFilter} onChange={(e) => setModFilter(e.target.value)} disabled={!subject} className="h-8 text-xs" />
                <NativeSelect value={module} onChange={(e) => setModule(e.target.value)} disabled={!subject}>
                  <option value="">{subject ? "Choose module (optional)…" : "Pick a subject first"}</option>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </NativeSelect>
              </div>
              {losOptions.length > 0 && <p className="text-xs text-muted-foreground">LOS linking available on the saved record.</p>}
              <Button className="w-full" onClick={runExtract} disabled={!images.length || extracting}>
                {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanText className="mr-2 h-4 w-4" />}
                {extracting ? "Reading screenshot…" : "Scan with AI"}
              </Button>
              {!extracted && <button className="w-full text-xs text-muted-foreground underline" onClick={() => setExtracted(true)}>or type the question manually</button>}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-3">
          {!extracted ? (
            <div className="card-soft flex h-full min-h-64 flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <ScanText className="h-10 w-10 text-primary/60" />
              <p className="mt-3">Add a screenshot and press <b>Scan with AI</b>. You'll review everything before it's saved.</p>
            </div>
          ) : (
            <Panel title="Review & save">
              {issues.length > 0 && (
                <div className="mb-4 rounded-lg border border-sun bg-sun/20 p-3 text-sm">
                  <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" /> Please check</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">{issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-1.5"><Label>Question</Label><Textarea rows={6} value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Answer choices</Label>
                  {choices.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <Input className="w-14" value={c.label} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <Input value={c.text} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                      <Button size="icon" variant="ghost" onClick={() => setChoices(choices.filter((_, j) => j !== i))} aria-label="Remove choice"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setChoices([...choices, { label: String.fromCharCode(65 + choices.length), text: "" }])}><Plus className="mr-1 h-3 w-3" /> Add choice</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Your answer</Label><Input value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="e.g. B" /></div>
                  <div className="space-y-1.5"><Label>Correct answer (if known)</Label><Input value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="Leave blank if unknown" />
                    {correct && <label className="flex items-center gap-2 text-xs"><Checkbox checked={verified} onCheckedChange={(v) => setVerified(!!v)} /> I've confirmed this from an official answer key</label>}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Concept</Label><Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="e.g. Macaulay duration" /></div>
                  <div className="space-y-1.5"><Label>Why did you get it wrong?</Label>
                    <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>{ERROR_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</NativeSelect>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Personal notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <Button size="lg" className="w-full" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save mistake"}</Button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Dialog open={!!dupe} onOpenChange={(o) => !o && setDupe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Looks like you've logged this before</DialogTitle>
            <DialogDescription className="line-clamp-3">{dupe?.question}</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDupe(null); save(true); }}>Save as new mistake</Button>
            <Button onClick={linkToExisting}>Link as new attempt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
