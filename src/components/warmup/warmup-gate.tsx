"use client";

import { useState, useSyncExternalStore } from "react";
import { PenWarmup } from "./pen-warmup";

const key = (subtopicId: string) => `sb_warmup_done_${subtopicId}`;
const noop = () => () => {};

function doneThisVisit(subtopicId: string): boolean {
  try {
    return sessionStorage.getItem(key(subtopicId)) === "1";
  } catch {
    return false;
  }
}

/**
 * Shows the pen warm-up before a lesson (once per lesson per browser session).
 * The lesson is mounted underneath while hidden, so a not-yet-cached deck
 * generates during the warm-up instead of after it.
 */
export function WarmupGate({ subtopicId, children }: { subtopicId: string; children: React.ReactNode }) {
  const alreadyDone = useSyncExternalStore(noop, () => doneThisVisit(subtopicId), () => false);
  const [finished, setFinished] = useState(false);
  const showWarmup = !alreadyDone && !finished;

  const finish = () => {
    try {
      sessionStorage.setItem(key(subtopicId), "1");
    } catch {
      /* ignore */
    }
    setFinished(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {showWarmup ? <PenWarmup onFinish={finish} /> : null}
      <div hidden={showWarmup}>{children}</div>
    </>
  );
}
