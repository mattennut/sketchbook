import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
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
  return process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
}

export function aiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_CAPABLE = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-2",
  "claude-fable-5-1",
  "claude-sonnet-5-5",
]);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ maxRetries: 2, timeout: 240_000 });
  return client;
}

type Content = string | Anthropic.Beta.BetaContentBlockParam[];

/**
 * One structured call to Claude:
 *  1. checks the per-session hourly limit and the global daily cap,
 *  2. asks for JSON matching `schema` (structured outputs),
 *  3. validates with zod + an optional domain validator (e.g. "ids must exist in the catalog"),
 *  4. on any problem, retries ONCE, telling the model exactly what was wrong.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  db: DB;
  kind: AiKind;
  sessionId: string | null;
  system: string;
  content: Content;
  schema: S;
  validate?: (data: z.infer<S>) => string[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  skipBudget?: boolean;
}): Promise<z.infer<S>> {
  if (!aiConfigured()) throw new AiError("not_configured", "ANTHROPIC_API_KEY is not set");

  if (!opts.skipBudget) {
    const budget = await checkAiBudget(opts.db, opts.sessionId, opts.kind);
    if (!budget.ok) throw new AiError(budget.reason, budget.reason);
  }

  const model = aiModel();
  const callId = await logAiStart(opts.db, opts.sessionId, opts.kind, model);
  const usage = { input: 0, output: 0 };
  const { type, schema } = betaZodOutputFormat(opts.schema);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.content }];
  let lastProblems: string[] = [];

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const stream = getClient().beta.messages.stream({
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        messages,
        output_config: { format: { type, schema }, effort: opts.effort ?? "medium" },
        ...(FALLBACK_CAPABLE.has(model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      });
      const msg = await stream.finalMessage();
      usage.input += msg.usage.input_tokens ?? 0;
      usage.output += msg.usage.output_tokens ?? 0;

      if (msg.stop_reason === "refusal") {
        throw new AiError("refused", "The model declined this request");
      }

      const text = msg.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const problems: string[] = [];
      let data: z.infer<S> | undefined;
      if (msg.stop_reason === "max_tokens") problems.push("The output was cut off; keep it shorter.");
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
      messages.push(
        { role: "assistant", content: msg.content as unknown as Anthropic.Beta.BetaContentBlockParam[] },
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
    if (err instanceof Anthropic.APIError) {
      console.error(`[ai:${opts.kind}] API error ${err.status}: ${err.message}`);
      throw new AiError("upstream", err.message);
    }
    console.error(`[ai:${opts.kind}]`, err);
    throw new AiError("upstream", err instanceof Error ? err.message : String(err));
  }
}

export function imageBlock(data: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp") {
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: mediaType, data: data.toString("base64") },
  };
}
