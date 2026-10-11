import { describe, it, expect } from "vitest";
import { prioritizeRevisions } from "./revision-priority";

const r = (id: string, module_id: string, stage: number, due_date: string, completed_at: string | null = null) => ({ id, module_id, stage, due_date, completed_at });

describe("prioritizeRevisions", () => {
  it("orders earliest due first and suggests only the next open stage per module", () => {
    const out = prioritizeRevisions([
      r("a1", "A", 1, "2026-10-05", "x"),
      r("a2", "A", 2, "2026-10-08"),
      r("a3", "A", 3, "2026-10-12"),
      r("b1", "B", 1, "2026-10-02"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["b1", "a2"]);
  });
});
