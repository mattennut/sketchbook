import { NextResponse } from "next/server";
import { AI_ERROR_COPY, AiError } from "./ai/client";

export function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Maps thrown errors to calm, user-facing JSON. Never leaks internals. */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof AiError) {
    const status =
      err.code === "session_limit" || err.code === "daily_cap" ? 429 : err.code === "not_configured" ? 503 : 502;
    return jsonError(status, err.code, AI_ERROR_COPY[err.code]);
  }
  console.error(`[${context}]`, err);
  return jsonError(500, "server_error", "Something went wrong on our side. Please try again.");
}
