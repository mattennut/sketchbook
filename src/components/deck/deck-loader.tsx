"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { StoredDeck } from "@/lib/content";
import { isSetupError, useLessonContent } from "@/lib/client/use-content";
import { InkLoader } from "../ink-loader";
import { ErrorState } from "../states";
import { DeckViewer } from "./deck-viewer";

export function DeckLoader({ subtopicId, title }: { subtopicId: string; title: string }) {
  const { state, retry } = useLessonContent<StoredDeck>("deck", subtopicId);

  // Warm the practice tasks in the background while the learner reads.
  useEffect(() => {
    void fetch(`/api/content/tasks/${subtopicId}`, { cache: "no-store" }).catch(() => {});
  }, [subtopicId]);

  if (state.status === "ready") return <DeckViewer deck={state.content} subtopicId={subtopicId} />;
  if (state.status === "failed") {
    return (
      <ErrorState
        title="This lesson isn't ready"
        message={state.message}
        action={
          state.code === "paywall" ? (
            <Link href="/upgrade" className="btn btn-primary">
              See Plus
            </Link>
          ) : isSetupError(state.code) ? (
            <Link href="/plan" className="btn btn-primary">
              Back to my plan
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={retry}>
              Try again
            </button>
          )
        }
      />
    );
  }
  return (
    <InkLoader
      className="py-24"
      messages={
        state.status === "loading"
          ? ["Opening your lesson…"]
          : [
              `Writing your lesson on ${title.toLowerCase()}…`,
              "Drawing the diagram…",
              "Keeping it short — you've got drawing to do…",
              "First learner to open this one — it'll be instant for everyone after.",
            ]
      }
    />
  );
}
