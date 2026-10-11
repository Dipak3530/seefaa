export type OpenCheckpoint = { id: string; module_id: string; stage: number; due_date: string; completed_at: string | null };

/** Earliest due first; ties go to the lower R stage. Only one (lowest) open stage per module is suggested. */
export function prioritizeRevisions<T extends OpenCheckpoint>(rows: T[]): T[] {
  const open = rows.filter((r) => !r.completed_at);
  const firstPerModule = new Map<string, T>();
  for (const r of open) {
    const cur = firstPerModule.get(r.module_id);
    if (!cur || r.stage < cur.stage) firstPerModule.set(r.module_id, r);
  }
  return [...firstPerModule.values()].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.stage - b.stage);
}
