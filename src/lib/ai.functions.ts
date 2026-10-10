import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";
const DAILY_LIMIT = 40;

class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/** Streams a Responses call and returns the final text. */
async function callResponses(body: Record<string, unknown>) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("AI is not configured.", 500);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: MODEL, stream: true, store: false, reasoning: { effort: "low" }, ...body }),
  });
  if (!res.ok || !res.body) {
    let msg = "The AI service is unavailable right now. Your data is saved — try again later.";
    try {
      const j = (await res.json()) as { message?: string; error?: { message?: string } };
      if (res.status === 402 || res.status === 403 || res.status === 429) msg = j.message ?? j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new AiError(msg, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        if (ev.type === "response.failed") throw new AiError(ev.response?.error?.message ?? "AI request failed.");
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  if (!text.trim()) throw new AiError("The AI returned no answer. Please try again.");
  return text;
}

async function checkQuota(supabase: any, userId: string, kind: string) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) throw new AiError(`Daily AI limit of ${DAILY_LIMIT} requests reached. It resets within 24 hours.`, 429);
  await supabase.from("ai_usage").insert({ user_id: userId, kind });
}

const SUBJECT_IDS = ["quant", "econ", "fsa", "corp", "equity", "fi", "deriv", "pm", "alts", "ethics"];

const extractSchema = {
  type: "object",
  additionalProperties: false,
  required: ["legible", "question", "choices", "selected_answer", "correct_answer", "correct_answer_shown", "suggested_subject_id", "suggested_module_title", "concept", "suggested_error_category", "issues"],
  properties: {
    legible: { type: "boolean" },
    question: { type: ["string", "null"], description: "Question text exactly as visible, including numbers and tables in plain text/markdown." },
    choices: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["label", "text"], properties: { label: { type: "string" }, text: { type: "string" } } },
    },
    selected_answer: { type: ["string", "null"], description: "Choice label the candidate selected, only if visibly marked." },
    correct_answer: { type: ["string", "null"], description: "Only if the screenshot explicitly shows the correct answer." },
    correct_answer_shown: { type: "boolean" },
    suggested_subject_id: { type: ["string", "null"], enum: [...SUBJECT_IDS, null] },
    suggested_module_title: { type: ["string", "null"] },
    concept: { type: ["string", "null"] },
    suggested_error_category: {
      type: ["string", "null"],
      enum: ["conceptual", "formula_forgotten", "formula_misapplied", "calculator", "misread", "interpretation", "arithmetic", "similar_concepts", "guessed", "other", null],
    },
    issues: { type: "array", items: { type: "string" }, description: "Specific things the candidate must check or fill in." },
  },
};

export const extractQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ images: z.array(z.string().startsWith("data:image/")).min(1).max(4), moduleTitles: z.array(z.string()).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const total = data.images.reduce((a, s) => a + s.length, 0);
    if (total > 9_000_000) return { ok: false as const, error: "Images are too large. Try fewer or smaller screenshots." };
    try {
      await checkQuota(context.supabase, context.userId, "extract");
      const text = await callResponses({
        instructions:
          "You extract CFA Level I practice questions from screenshots for a candidate's private mistake log. Transcribe only what is visible. NEVER invent question text, numbers, answer choices, or a correct answer. If something is cut off or unreadable, leave it null/empty and list it in issues. Only set correct_answer when the image explicitly marks or states it.",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Extract the question. If helpful, pick the closest module title from: ${data.moduleTitles.join(" | ") || "(none)"}` },
              ...data.images.map((url) => ({ type: "input_image", image_url: url })),
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "extraction", strict: true, schema: extractSchema } },
      });
      return { ok: true as const, result: JSON.parse(text) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Extraction failed." };
    }
  });

const MODES: Record<string, string> = {
  full: `Write a structured explanation with these markdown sections:
## Concept in plain language
## Why your answer was likely wrong
## Correct reasoning, step by step
## Other answer choices
## Formulas & calculation
## BA II Plus keystrokes (only if a calculation applies; otherwise say "Not applicable")
## Fresh example (original, not from any question bank)
## Common exam traps
## Related concepts & your earlier mistakes
## New practice question (original MCQ with A/B/C, answer and brief explanation hidden under a "Answer" heading)
## Suggested revision date`,
  simpler: "Explain the concept again, much more simply, as if to a beginner, with one everyday analogy. Keep it short.",
  calculation: "Show only the full calculation step by step with formulas and, where relevant, BA II Plus keystrokes.",
  compare: "Compare this concept with the most commonly confused similar CFA concepts in a markdown table, then give a one-line rule to tell them apart.",
  example: "Give one new original worked example of the same concept with different numbers.",
  quiz: "Write 3 new original multiple-choice questions (A/B/C) testing this concept. Put all answers with short explanations at the end under '## Answers'.",
};

export const explainMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mistakeId: z.string().uuid(), mode: z.enum(["full", "simpler", "calculation", "compare", "example", "quiz"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: m } = await sb.from("mistakes").select("*").eq("id", data.mistakeId).maybeSingle();
    if (!m) return { ok: false as const, error: "Mistake not found." };
    try {
      await checkQuota(sb, context.userId, "explain");
      const [{ data: mod }, { data: prior }] = await Promise.all([
        m.module_id ? sb.from("modules").select("title").eq("id", m.module_id).maybeSingle() : Promise.resolve({ data: null }),
        sb.from("mistakes").select("question, concept, error_category, created_at").neq("id", m.id)
          .or(`module_id.eq.${m.module_id ?? "none"}${m.concept ? `,concept.ilike.%${m.concept.replace(/[%,()]/g, "").slice(0, 40)}%` : ""}`)
          .order("created_at", { ascending: false }).limit(6),
      ]);
      const choices = Array.isArray(m.choices) ? (m.choices as { label: string; text: string }[]).map((c) => `${c.label}. ${c.text}`).join("\n") : "";
      const context_ = `Subject: ${m.subject_id ?? "unknown"}; Module: ${mod?.title ?? "unknown"}; Concept: ${m.concept ?? "unknown"}
Question:\n${m.question}\nChoices:\n${choices || "(none recorded)"}
Candidate selected: ${m.selected_answer ?? "unknown"}
Correct answer: ${m.correct_answer ? `${m.correct_answer}${m.correct_verified ? " (verified by candidate)" : " (unverified)"}` : "NOT PROVIDED"}
Candidate's error category: ${m.error_category}; notes: ${m.notes ?? "none"}
Earlier related mistakes by this candidate (${prior?.length ?? 0}):\n${(prior ?? []).map((p: any) => `- [${p.error_category}] ${p.concept ?? ""}: ${String(p.question).slice(0, 160)}`).join("\n") || "none"}`;
      const content = await callResponses({
        instructions:
          "You are SEEFAA's CFA Level I tutor. Be accurate and clear. Do not reproduce copyrighted CFA Institute text. If the correct answer was not provided and cannot be established with certainty from the question, say so explicitly and ask the candidate to confirm it — never present a guess as fact. If earlier related mistakes show a pattern, start with a short '⚠ Recurring weakness' note explaining it.",
        input: [{ role: "user", content: [{ type: "input_text", text: `${MODES[data.mode]}\n\n${context_}` }] }],
      });
      const { data: saved } = await sb.from("ai_explanations").insert({ user_id: context.userId, mistake_id: m.id, mode: data.mode, content }).select().single();
      return { ok: true as const, explanation: saved };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Explanation failed." };
    }
  });

export const explainFormula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ formulaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: f } = await sb.from("formulas").select("*").eq("id", data.formulaId).maybeSingle();
    if (!f) return { ok: false as const, error: "Formula not found." };
    try {
      await checkQuota(sb, context.userId, "formula");
      const content = await callResponses({
        instructions: "You are a CFA Level I tutor. Explain formulas clearly with an original worked example and BA II Plus keystrokes where relevant. Use markdown.",
        input: [{ role: "user", content: [{ type: "input_text", text: `Formula: ${f.name}\nExpression: ${f.expression}\nVariables: ${f.variables ?? ""}\nExplain when to use it, an original example, calculator steps and common mistakes.` }] }],
      });
      const { data: saved } = await sb.from("ai_explanations").insert({ user_id: context.userId, formula_id: f.id, mode: "formula", content }).select().single();
      return { ok: true as const, explanation: saved };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Explanation failed." };
    }
  });
