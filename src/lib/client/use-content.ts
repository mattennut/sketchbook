"use client";

import { useCallback, useEffect, useState } from "react";

export type ContentResult<T> =
  | { status: "loading" }
  | { status: "generating" }
  | { status: "ready"; content: T }
  | { status: "failed"; message: string; code?: string };

/**
 * Fetches shared lesson content. While another request (or this one) is generating it,
 * polls with gentle backoff. Never leaves the UI blank: every state maps to a view.
 */
export function useLessonContent<T>(kind: "deck" | "tasks", subtopicId: string) {
  const [state, setState] = useState<ContentResult<T>>({ status: "loading" });
  // Bumping the nonce re-runs the effect; POST asks the server to retry a failed generation.
  const [request, setRequest] = useState<{ n: number; method: "GET" | "POST" }>({ n: 0, method: "GET" });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function run(method: "GET" | "POST") {
      try {
        const res = await fetch(`/api/content/${kind}/${subtopicId}`, { method, cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setState({
            status: "failed",
            code: data?.error?.code,
            message: data?.error?.message ?? "We couldn't load this lesson.",
          });
        } else if (data.status === "ready") {
          setState({ status: "ready", content: data.content as T });
        } else if (data.status === "generating") {
          setState({ status: "generating" });
          attempt += 1;
          timer = setTimeout(() => void run("GET"), Math.min(6000, 1800 + attempt * 400));
        } else {
          setState({ status: "failed", code: data.error, message: data.message ?? "We couldn't prepare this lesson." });
        }
      } catch {
        if (alive) setState({ status: "failed", message: "You seem to be offline. Check your connection and try again." });
      }
    }

    void run(request.method);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [kind, subtopicId, request]);

  const retry = useCallback(() => {
    setState({ status: "generating" });
    setRequest((r) => ({ n: r.n + 1, method: "POST" }));
  }, []);

  return { state, retry };
}
