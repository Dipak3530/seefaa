import { describe, expect, it } from "vitest";
import { formatQuestionMarkdown } from "@/lib/question-format";

describe("source question table formatting", () => {
  it("preserves the uploaded capital structure values when a row wraps", () => {
    const text = "| Type | Amount |\n|--|--|\n| Senior secured bonds (pledged by collateral valued at 60) |\n50 |\n| Senior unsecured bonds | 35 |\n| Subordinated bonds | 15 |\n| Common equity | 100 |";
    expect(formatQuestionMarkdown(text)).toBe("| Type | Amount |\n| --- | --- |\n| Senior secured bonds (pledged by collateral valued at 60) | 50 |\n| Senior unsecured bonds | 35 |\n| Subordinated bonds | 15 |\n| Common equity | 100 |");
  });
  it("leaves ordinary question content and answers unchanged", () => {
    const text = "A firm's value is 50 | 35.\n\nA. Full recovery\nB. Partial recovery";
    expect(formatQuestionMarkdown(text)).toBe(text);
  });
  it("does not guess missing table values", () => {
    expect(formatQuestionMarkdown("| Type | Amount |\n|---|---|\n| Bond |\n\nWhich answer is correct?")).toBe("| Type | Amount |\n| --- | --- |\n| Bond |\n\nWhich answer is correct?");
  });
});