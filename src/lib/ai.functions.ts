import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

type Provider = "openai" | "anthropic" | "gemini";
type AiKey = { provider: Provider; api_key: string };

const PROVIDER_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash",
};

async function getUserKey(supabase: any, userId: string): Promise<AiKey> {
  const { data } = await supabase.from("user_ai_keys").select("provider, api_key").eq("user_id", userId).maybeSingle();
  if (!data) throw new AiError("No AI key connected yet. Add your own OpenAI, Anthropic or Gemini key in Settings → AI key to use AI explanations.", 400);
  return data as AiKey;
}

function parseDataUrl(url: string): { mime: string; base64: string } {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(url);
  if (!m) throw new AiError("Unsupported image format.", 400);
  return { mime: m[1], base64: m[2] };
}

type AiRequest = { instructions: string; text: string; images?: string[]; jsonSchema?: { name: string; schema: Record<string, unknown> } };

async function callOpenAI(key: string, req: AiRequest): Promise<string> {
  const content: unknown[] = [{ type: "text", text: req.text }];
  for (const img of req.images ?? []) content.push({ type: "image_url", image_url: { url: img } });
  const body: Record<string, unknown> = {
    model: PROVIDER_MODELS.openai,
    messages: [
      { role: "system", content: req.instructions },
      { role: "user", content },
    ],
  };
  if (req.jsonSchema) body.response_format = { type: "json_schema", json_schema: { name: req.jsonSchema.name, strict: true, schema: req.jsonSchema.schema } };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await providerError(res, "OpenAI");
  const j = (await res.json()) as any;
  const text = j.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new AiError("The AI returned no answer. Please try again.");
  return text;
}

async function callAnthropic(key: string, req: AiRequest): Promise<string> {
  const content: unknown[] = [];
  for (const img of req.images ?? []) {
    const { mime, base64 } = parseDataUrl(img);
    content.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } });
  }
  let text = req.text;
  if (req.jsonSchema) text += `\n\nRespond with ONLY valid JSON matching this schema (no markdown fences):\n${JSON.stringify(req.jsonSchema.schema)}`;
  content.push({ type: "text", text });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: PROVIDER_MODELS.anthropic, max_tokens: 4096, system: req.instructions, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw await providerError(res, "Anthropic");
  const j = (await res.json()) as any;
  const out = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  if (!out.trim()) throw new AiError("The AI returned no answer. Please try again.");
  return out;
}

async function callGemini(key: string, req: AiRequest): Promise<string> {
  const parts: unknown[] = [{ text: req.text }];
  for (const img of req.images ?? []) {
    const { mime, base64 } = parseDataUrl(img);
    parts.push({ inlineData: { mimeType: mime, data: base64 } });
  }
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.instructions }] },
    contents: [{ role: "user", parts }],
  };
  if (req.jsonSchema) body.generationConfig = { responseMimeType: "application/json", responseSchema: geminiSchema(req.jsonSchema.schema) };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_MODELS.gemini}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await providerError(res, "Gemini");
  const j = (await res.json()) as any;
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  if (!text.trim()) throw new AiError("The AI returned no answer. Please try again.");
  return text;
}

/** Convert a JSON schema to Gemini's subset (no unions/nullable, no additionalProperties). */
function geminiSchema(s: any): any {
  if (Array.isArray(s?.type)) {
    const t = s.type.filter((x: string) => x !== "null")[0];
    return { ...geminiSchema({ ...s, type: t }), nullable: true };
  }
  const out: any = {};
  if (s?.type) out.type = String(s.type).toUpperCase();
  if (s?.description) out.description = s.description;
  if (s?.enum) out.enum = s.enum.filter((x: unknown) => x !== null);
  if (s?.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, geminiSchema(v)]));
    if (s.required) out.required = s.required;
  }
  if (s?.items) out.items = geminiSchema(s.items);
  return out;
}

async function providerError(res: Response, name: string): Promise<AiError> {
  let msg = `${name} returned an error (${res.status}).`;
  try {
    const j = (await res.json()) as any;
    msg = j?.error?.message ?? j?.message ?? msg;
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) msg = `Your ${name} key was rejected. Check it in Settings → AI key.`;
  if (res.status === 429) msg = `${name} rate limit reached on your key. Wait a moment and try again.`;
  return new AiError(msg, res.status);
}

async function callUserAi(key: AiKey, req: AiRequest): Promise<string> {
  if (key.provider === "openai") return callOpenAI(key.api_key, req);
  if (key.provider === "anthropic") return callAnthropic(key.api_key, req);
  return callGemini(key.api_key, req);
}

/** Validates a key with a tiny live call, then saves it (one key per user). */
export const saveAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.enum(["openai", "anthropic", "gemini"]), apiKey: z.string().min(10).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await callUserAi({ provider: data.provider, api_key: data.apiKey }, { instructions: "You are a health check.", text: "Reply with the single word: ok" });
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "The key could not be verified." };
    }
    const { error } = await context.supabase.from("user_ai_keys").upsert({ user_id: context.userId, provider: data.provider, api_key: data.apiKey, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

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
      const key = await getUserKey(context.supabase, context.userId);
      const text = await callUserAi(key, {
        instructions:
          "You extract CFA Level I practice questions from screenshots for a candidate's private mistake log. Transcribe only what is visible. NEVER invent question text, numbers, answer choices, or a correct answer. If something is cut off or unreadable, leave it null/empty and list it in issues. Only set correct_answer when the image explicitly marks or states it.",
        text: `Extract the question. If helpful, pick the closest module title from: ${data.moduleTitles.join(" | ") || "(none)"}`,
        images: data.images,
        jsonSchema: { name: "extraction", schema: extractSchema },
      });
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
      const key = await getUserKey(sb, context.userId);
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
      const content = await callUserAi(key, {
        instructions:
          "You are SEEFAA's CFA Level I tutor. Be accurate and clear. Do not reproduce copyrighted CFA Institute text. If the correct answer was not provided and cannot be established with certainty from the question, say so explicitly and ask the candidate to confirm it — never present a guess as fact. If earlier related mistakes show a pattern, start with a short '⚠ Recurring weakness' note explaining it.",
        text: `${MODES[data.mode]}\n\n${context_}`,
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
      const key = await getUserKey(sb, context.userId);
      const content = await callUserAi(key, {
        instructions: "You are a CFA Level I tutor. Explain formulas clearly with an original worked example and BA II Plus keystrokes where relevant. Use markdown.",
        text: `Formula: ${f.name}\nExpression: ${f.expression}\nVariables: ${f.variables ?? ""}\nExplain when to use it, an original example, calculator steps and common mistakes.`,
      });
      const { data: saved } = await sb.from("ai_explanations").insert({ user_id: context.userId, formula_id: f.id, mode: "formula", content }).select().single();
      return { ok: true as const, explanation: saved };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Explanation failed." };
    }
  });
