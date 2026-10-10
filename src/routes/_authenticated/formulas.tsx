import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, Sigma, Sparkles, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Empty, NativeSelect, Markdown } from "@/components/seefaa/bits";
import { useCurriculum } from "@/hooks/use-seefaa";
import { explainFormula } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/formulas")({
  head: () => ({ meta: [{ title: "Formula Notebook — SEEFAA" }, { name: "description", content: "Your personal CFA formula and concept notebook." }] }),
  component: Formulas,
});

const FIELDS: [keyof Tables<"formulas">, string][] = [
  ["variables", "Variable definitions"], ["conditions", "When to use it"], ["explanation", "In my own words"],
  ["example", "Example"], ["calculator", "Calculator steps (BA II Plus)"], ["common_mistakes", "Common mistakes"],
];
const empty = { name: "", expression: "", subject_id: "", module_id: "", tags: "", variables: "", conditions: "", explanation: "", example: "", calculator: "", common_mistakes: "", revision_status: "new" };

function Formulas() {
  const { data: cur } = useCurriculum();
  const explain = useServerFn(explainFormula);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ["formulas"],
    queryFn: async () => {
      const [f, e] = await Promise.all([
        supabase.from("formulas").select("*").order("created_at", { ascending: false }),
        supabase.from("ai_explanations").select("*").not("formula_id", "is", null).order("created_at", { ascending: false }),
      ]);
      return { formulas: f.data ?? [], ex: e.data ?? [] };
    },
  });
  if (!cur) return null;
  const list = (data?.formulas ?? []).filter((f) => (!subject || f.subject_id === subject) && (!favOnly || f.favorite) &&
    (!q || `${f.name} ${f.expression} ${f.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())));

  async function save() {
    if (!edit?.name || !edit.expression) return toast.error("Name and formula are required.");
    const { data: u } = await supabase.auth.getUser();
    const row = { ...edit, user_id: u.user!.id, subject_id: edit.subject_id || null, module_id: edit.module_id || null, tags: edit.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    const { id, ...rest } = row;
    const { error } = id ? await supabase.from("formulas").update(rest).eq("id", id) : await supabase.from("formulas").insert(rest);
    if (error) return toast.error(error.message);
    setEdit(null); refetch();
  }
  async function patch(id: string, p: Partial<Tables<"formulas">>) { await supabase.from("formulas").update(p).eq("id", id); refetch(); }
  async function del(id: string) { if (!confirm("Delete this formula?")) return; await supabase.from("formulas").delete().eq("id", id); refetch(); }
  async function ai(id: string) {
    setBusy(id);
    const r = await explain({ data: { formulaId: id } });
    setBusy(null);
    if (!r.ok) toast.error(r.error); else refetch();
  }

  return (
    <div>
      <PageHeader title="Formula Notebook" subtitle="Write formulas in your own words. Search, tag and favourite the ones that matter." actions={<Button onClick={() => setEdit({ ...empty })}><Plus className="mr-2 h-4 w-4" />New formula</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="bg-card pl-8" placeholder="Search name, formula or tag" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <NativeSelect className="w-48" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All subjects</option>{cur.subjects.map((s) => <option key={s.id} value={s.id}>{s.short_name}</option>)}</NativeSelect>
        <Button variant={favOnly ? "default" : "outline"} onClick={() => setFavOnly(!favOnly)}><Star className="mr-1 h-4 w-4" />Favourites</Button>
      </div>
      {!list.length ? <Empty icon={<Sigma className="h-8 w-8" />} title="No formulas yet" body="Add the formulas you keep forgetting — they'll be here for quick recall." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((f) => {
            const ex = data?.ex.find((e) => e.formula_id === f.id);
            return (
              <div key={f.id} className="card-soft p-5">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{cur.subject(f.subject_id)?.short_name}{f.module_id ? ` · ${cur.module(f.module_id)?.title}` : ""}</p>
                  </div>
                  <button onClick={() => patch(f.id, { favorite: !f.favorite })} aria-label="Favourite"><Star className={cn("h-5 w-5", f.favorite ? "fill-sun text-sun" : "text-muted-foreground")} /></button>
                </div>
                <p className="my-4 overflow-x-auto rounded-md border bg-background p-4 font-mono text-base">{f.expression}</p>
                <dl className="space-y-1.5 text-sm">{FIELDS.filter(([k]) => f[k]).map(([k, l]) => <div key={k}><dt className="text-xs font-medium text-muted-foreground">{l}</dt><dd className="whitespace-pre-wrap">{String(f[k])}</dd></div>)}</dl>
                {f.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{f.tags.map((t) => <span key={t} className="rounded bg-secondary px-1.5 text-[11px]">#{t}</span>)}</div>}
                {ex && <details className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium text-primary">AI explanation</summary><div className="mt-2"><Markdown>{ex.content}</Markdown></div></details>}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <NativeSelect className="h-8 w-36 text-xs" value={f.revision_status} onChange={(e) => patch(f.id, { revision_status: e.target.value })}>
                    <option value="new">New</option><option value="reviewing">Reviewing</option><option value="known">Know it</option>
                  </NativeSelect>
                  <Button size="sm" variant="secondary" onClick={() => ai(f.id)} disabled={busy === f.id}>{busy === f.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Explain & example</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ ...empty, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v ?? ""])), tags: f.tags.join(", "), id: f.id } as typeof empty & { id: string })}>Edit</Button>
                  <Button size="icon" variant="ghost" onClick={() => del(f.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit formula" : "New formula"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-2">
              <Input placeholder="Name, e.g. Macaulay duration" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Textarea placeholder="Formula expression" className="font-mono" value={edit.expression} onChange={(e) => setEdit({ ...edit, expression: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <NativeSelect value={edit.subject_id} onChange={(e) => setEdit({ ...edit, subject_id: e.target.value, module_id: "" })}><option value="">Subject</option>{cur.subjects.map((s) => <option key={s.id} value={s.id}>{s.short_name}</option>)}</NativeSelect>
                <NativeSelect value={edit.module_id} onChange={(e) => setEdit({ ...edit, module_id: e.target.value })} disabled={!edit.subject_id}><option value="">Module</option>{cur.modulesOf(edit.subject_id).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</NativeSelect>
              </div>
              {FIELDS.map(([k, l]) => <Textarea key={k} rows={2} placeholder={l} value={(edit as Record<string, string>)[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />)}
              <Input placeholder="Tags, comma separated" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} />
            </div>
          )}
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
