"use client";

import Link from "next/link";
import { ErrorState } from "@/components/states";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4">
      <ErrorState
        title="Something smudged"
        message="We hit a problem loading this page. Your progress is safe."
        action={
          <div className="flex items-center gap-4">
            <button className="btn btn-primary" onClick={reset}>
              Try again
            </button>
            <Link href="/" className="link text-ink-soft">
              Home
            </Link>
          </div>
        }
      />
    </div>
  );
}
