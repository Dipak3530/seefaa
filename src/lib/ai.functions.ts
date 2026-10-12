import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";
const DAILY_LIMIT = 40;

type AiRequest = { instructions: string; text: string; images?: string[]; jsonSchema?: { name: string; schema: Record<string, unknown> } };

/** Per-user daily call budget, tracked in ai_usage. */
async function checkBudget(supabase: any, userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) throw new AiError("Daily AI limit reached. Try again tomorrow.", 429);
}

async function recordUsage(supabase: any, userId: string, kind: string) {
  await supabase.from("ai_usage").insert({ user_id: userId, kind });
}

/** Streamed call to the built-in Lovable AI gateway (Responses API). Returns the final text. */
async function callGateway(req: AiRequest): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new AiError("AI is not configured on the server.", 500);

  const content: unknown[] = [{ type: "input_text", text: req.text }];
  for (const img of req.images ?? []) content.push({ type: "input_image", image_url: img });

  const body: Record<string, unknown> = {
    model: MODEL,
    store: false,
    stream: true,
    reasoning: { effort: "low" },
    instructions: req.instructions,
    input: [{ role: "user", content }],
  };
  if (req.jsonSchema) {
    body.text = { format: { type: "json_schema", name: req.jsonSchema.name, strict: true, schema: req.jsonSchema.schema } };
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let msg = `The AI service returned an error (${res.status}).`;
    try {
      const j = (await res.json()) as any;
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* ignore */
    }
    if (res.status === 429) msg = "The AI service is busy right now. Wait a moment and try again.";
    throw new AiError(msg, res.status);
  }

  // Consume the SSE stream and accumulate text deltas.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        if (ev.type === "response.failed") throw new AiError("The AI request failed. Please try again.");
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  if (!out.trim()) throw new AiError("The AI returned no answer. Please try again.");
  return out;
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

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    if (m) return JSON.parse(m[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new AiError("The AI response could not be read. Please try again.");
  }
}

export const extractQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ images: z.array(z.string().startsWith("data:image/")).min(1).max(4), moduleTitles: z.array(z.string()).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const total = data.images.reduce((a, s) => a + s.length, 0);
    if (total > 9_000_000) return { ok: false as const, error: "Images are too large. Try fewer or smaller screenshots." };
    try {
      await checkBudget(context.supabase, context.userId);
      const text = await callGateway({
        instructions:
          "You extract CFA Level I practice questions from screenshots for a candidate's private mistake log. Transcribe only what is visible. NEVER invent question text, numbers, answer choices, or a correct answer. If something is cut off or unreadable, leave it null/empty and list it in issues. Only set correct_answer when the image explicitly marks or states it.",
        text: `Extract the question. If helpful, pick the closest module title from: ${data.moduleTitles.join(" | ") || "(none)"}`,
        images: data.images,
        jsonSchema: { name: "extraction", schema: extractSchema },
      });
      await recordUsage(context.supabase, context.userId, "extract");
      return { ok: true as const, result: parseJson(text) };
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
      await checkBudget(sb, context.userId);
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
      const content = await callGateway({
        instructions:
          "You are SEEFAA's CFA Level I tutor. Be accurate and clear. Do not reproduce copyrighted CFA Institute text. If the correct answer was not provided and cannot be established with certainty from the question, say so explicitly and ask the candidate to confirm it — never present a guess as fact. If earlier related mistakes show a pattern, start with a short '⚠ Recurring weakness' note explaining it.",
        text: `${MODES[data.mode]}\n\n${context_}`,
      });
      await recordUsage(sb, context.userId, "explain");
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
      await checkBudget(sb, context.userId);
      const content = await callGateway({
        instructions: "You are a CFA Level I tutor. Explain formulas clearly with an original worked example and BA II Plus keystrokes where relevant. Use markdown.",
        text: `Formula: ${f.name}\nExpression: ${f.expression}\nVariables: ${f.variables ?? ""}\nExplain when to use it, an original example, calculator steps and common mistakes.`,
      });
      await recordUsage(sb, context.userId, "formula");
      const { data: saved } = await sb.from("ai_explanations").insert({ user_id: context.userId, formula_id: f.id, mode: "formula", content }).select().single();
      return { ok: true as const, explanation: saved };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Explanation failed." };
    }
  });
