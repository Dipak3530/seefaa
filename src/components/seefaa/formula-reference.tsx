import { ExternalLink, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REFERENCE_FORMULAS, REFERENCE_SUBJECTS, referenceMatches, type ReferenceFormula } from "@/lib/formula-reference";
import sourceAsset from "@/assets/cfa-cheat-sheet.asset.json";

export function FormulaReference({ subjectName, search, onSave }: { subjectName: string; search: string; onSave: (formula: ReferenceFormula) => void }) {
  const matches = REFERENCE_FORMULAS.filter((f) => referenceMatches(f, subjectName, search));
  const subjects = REFERENCE_SUBJECTS.filter((s) => !subjectName || s.toLowerCase().replace(/[^a-z]/g, "") === subjectName.toLowerCase().replace(/[^a-z]/g, ""));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">CFI Education · 2025 cheat sheet · {matches.length} formulas</p>
        <Button asChild variant="outline" size="sm"><a href={sourceAsset.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Original PDF</a></Button>
      </div>
      <p className="mb-6 text-xs leading-5 text-muted-foreground">Source: uploaded 2025 sheet, not verified against the 2027 curriculum. Printed discrepancies are flagged.</p>
      {subjects.map((subject) => {
        const rows = matches.filter((f) => f.subject === subject);
        if (!rows.length && search.trim()) return null;
        return <section key={subject} className="mb-8">
          <h2 className="mb-4 flex flex-wrap items-baseline gap-2 font-display text-lg font-bold">{subject}<span className="text-xs font-normal text-muted-foreground">{rows.length} formulas</span></h2>
          {!rows.length ? <p className="text-sm text-muted-foreground">No mathematical formulas are included for this subject in the uploaded sheet.</p> : <div className="grid gap-4 md:grid-cols-2">
            {rows.map((formula) => <article key={formula.id} className="card-soft min-w-0 p-5">
              <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 text-sm font-bold">{formula.name}</h3><Button size="icon" variant="ghost" title="Save to my notebook" aria-label={`Save ${formula.name} to my notebook`} onClick={() => onSave(formula)}><NotebookPen className="h-4 w-4" /></Button></div>
              <p className="my-3 whitespace-pre-wrap break-words rounded-md border border-border bg-background p-4 font-mono text-sm leading-7">{formula.expression}</p>
              {formula.note && <p className="mb-3 text-xs leading-5 text-muted-foreground">{formula.note}</p>}
              <a className="text-xs text-primary underline underline-offset-4" href={`${sourceAsset.url}#page=${formula.page}`} target="_blank" rel="noopener noreferrer">2025 cheat sheet · page {formula.page}</a>
            </article>)}
          </div>}
        </section>;
      })}
      {!matches.length && search.trim() && <p className="py-8 text-sm text-muted-foreground">No matching formulas.</p>}
    </div>
  );
}