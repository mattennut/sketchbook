import OpenAI from "openai";
import { z } from "zod";
import type { DB } from "../db";
import { checkAiBudget, logAiFinish, logAiStart, type AiKind } from "./budget";

export type AiErrorCode =
  | "not_configured"
  | "session_limit"
  | "daily_cap"
  | "refused"
  | "invalid_output"
  | "upstream";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const AI_ERROR_COPY: Record<AiErrorCode, string> = {
  not_configured: "The AI coach isn't configured on this deployment yet.",
  session_limit: "You've hit this hour's limit for the AI coach. Take a break and try again soon.",
  daily_cap: "The AI coach has reached today's usage cap. Please come back tomorrow.",
  refused: "The coach couldn't review this one. Try a different image.",
  invalid_output: "The coach got muddled writing this up. Please try again.",
  upstream: "The AI service is busy right now. Please try again in a minute.",
};

export function aiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Reasoning models (o-series, gpt-5 family) accept `reasoning_effort`; older chat models reject it. */
function supportsReasoningEffort(model: string) {
  return /^(o\d|gpt-5)/.test(model) && !model.includes("chat-latest");
}

let client: OpenAI | null = null;
function getClient() {
  client ??= new OpenAI({ maxRetries: 2, timeout: 240_000 });
  return client;
}

/** Provider-neutral message parts used by callers. */
export type Part =
  | { type: "text"; text: string }
  | { type: "image"; data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export function imageBlock(data: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Part {
  return { type: "image", data, mediaType };
}

function toOpenAiContent(content: string | Part[]): OpenAI.Chat.ChatCompletionContentPart[] | string {
  if (typeof content === "string") return content;
  return content.map((p) =>
    p.type === "text"
      ? { type: "text" as const, text: p.text }
      : {
          type: "image_url" as const,
          image_url: { url: `data:${p.mediaType};base64,${p.data.toString("base64")}`, detail: "high" as const },
        },
  );
}

const KEEP = new Set([
  "type", "properties", "required", "additionalProperties", "items", "enum", "const", "anyOf",
  "description", "minimum", "maximum", "minItems", "maxItems", "$defs", "$ref",
]);

/**
 * Makes a zod-generated JSON Schema acceptable to OpenAI strict structured outputs:
 * every object closed and fully required, only supported keywords kept.
 * Constraints that get dropped are still enforced by zod after the response.
 */
function toStrictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrictSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (!KEEP.has(k)) continue;
    if (k === "properties" || k === "$defs") {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toStrictSchema(pv)]));
    } else {
      out[k] = toStrictSchema(v);
    }
  }
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  // Safe-integer bounds that zod adds to .int() are noise for the model.
  if (typeof out.minimum === "number" && out.minimum <= Number.MIN_SAFE_INTEGER) delete out.minimum;
  if (typeof out.maximum === "number" && out.maximum >= Number.MAX_SAFE_INTEGER) delete out.maximum;
  return out;
}

/**
 * One structured call to an OpenAI model:
 *  1. checks the per-session hourly limit and the global daily cap,
 *  2. asks for JSON matching `schema` (strict structured outputs),
 *  3. validates with zod + an optional domain validator (e.g. "ids must exist in the catalog"),
 *  4. on any problem, retries ONCE, telling the model exactly what was wrong.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  db: DB;
  kind: AiKind;
  sessionId: string | null;
  system: string;
  content: string | Part[];
  schema: S;
  validate?: (data: z.infer<S>) => string[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  skipBudget?: boolean;
}): Promise<z.infer<S>> {
  if (!aiConfigured()) throw new AiError("not_configured", "OPENAI_API_KEY is not set");

  if (!opts.skipBudget) {
    const budget = await checkAiBudget(opts.db, opts.sessionId, opts.kind);
    if (!budget.ok) throw new AiError(budget.reason, budget.reason);
  }

  const model = aiModel();
  const callId = await logAiStart(opts.db, opts.sessionId, opts.kind, model);
  const usage = { input: 0, output: 0 };
  const jsonSchema = toStrictSchema(z.toJSONSchema(opts.schema, { target: "draft-7" })) as Record<string, unknown>;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: toOpenAiContent(opts.content) },
  ];
  let lastProblems: string[] = [];

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await getClient().chat.completions.create({
        model,
        messages,
        max_completion_tokens: opts.maxTokens ?? 16000,
        response_format: {
          type: "json_schema",
          json_schema: { name: `sketchbook_${opts.kind}`, schema: jsonSchema, strict: true },
        },
        ...(supportsReasoningEffort(model) ? { reasoning_effort: opts.effort ?? "medium" } : {}),
      });
      usage.input += completion.usage?.prompt_tokens ?? 0;
      usage.output += completion.usage?.completion_tokens ?? 0;

      const choice = completion.choices[0];
      if (choice?.message.refusal) throw new AiError("refused", choice.message.refusal);
      const text = choice?.message.content ?? "";

      const problems: string[] = [];
      let data: z.infer<S> | undefined;
      if (choice?.finish_reason === "length") problems.push("The output was cut off; keep it shorter.");
      try {
        const parsed = opts.schema.safeParse(JSON.parse(text));
        if (parsed.success) {
          data = parsed.data;
          problems.push(...(opts.validate?.(data) ?? []));
        } else {
          problems.push(
            ...parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
          );
        }
      } catch {
        problems.push("The response was not valid JSON.");
      }

      if (data !== undefined && problems.length === 0) {
        await logAiFinish(opts.db, callId, "ok", usage);
        return data;
      }

      lastProblems = problems;
      console.info(`[ai:${opts.kind}] attempt ${attempt + 1} rejected: ${problems.slice(0, 3).join(" | ")}`);
      messages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `That output has problems:\n${problems.map((p) => `- ${p}`).join("\n")}\nReturn the complete, corrected JSON.`,
        },
      );
    }
    throw new AiError("invalid_output", `Invalid output after retry: ${lastProblems.join("; ")}`);
  } catch (err) {
    await logAiFinish(opts.db, callId, "error", usage).catch(() => {});
    if (err instanceof AiError) throw err;
    if (err instanceof OpenAI.APIError) {
      console.error(`[ai:${opts.kind}] API error ${err.status}: ${err.message}`);
      throw new AiError("upstream", err.message);
    }
    console.error(`[ai:${opts.kind}]`, err);
    throw new AiError("upstream", err instanceof Error ? err.message : String(err));
  }
}
