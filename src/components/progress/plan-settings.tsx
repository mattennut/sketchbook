"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SPECIALIZATIONS, SPECIALIZATION_INFO, type Specialization } from "@/lib/skills";
import { InkLoader } from "../ink-loader";

export function PlanSettings({ current, isPaid }: { current: Specialization; isPaid: boolean }) {
  const [spec, setSpec] = useState<Specialization>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; paywall?: boolean } | null>(null);
  const router = useRouter();
  const changed = spec !== current;

  const rebuild = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialization: spec }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError({ message: data?.error?.message ?? "Couldn't rebuild your plan.", paywall: res.status === 402 });
        setBusy(false);
        return;
      }
      router.push("/plan");
      router.refresh();
    } catch {
      setError({ message: "You seem to be offline." });
      setBusy(false);
    }
  };

  if (busy) return <InkLoader messages={["Rebuilding your twelve weeks…", "Re-ordering lessons around your latest profile…"]} />;

  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="font-medium">Specialization</span>
        <select
          value={spec}
          onChange={(e) => setSpec(e.target.value as Specialization)}
          className="h-12 rounded-xl border border-rule-strong bg-sheet px-3 text-base"
        >
          {SPECIALIZATIONS.map((s) => (
            <option key={s} value={s}>
              {SPECIALIZATION_INFO[s].label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {changed ? (
          <button className="btn btn-primary" onClick={rebuild}>
            Switch to {SPECIALIZATION_INFO[spec].label.toLowerCase()}
          </button>
        ) : isPaid ? (
          <button className="btn btn-secondary" onClick={rebuild}>
            Rebuild from my latest skills
          </button>
        ) : (
          <p className="text-sm text-ink-muted">
            Rebuilding the plan from your latest skills is part of{" "}
            <Link href="/upgrade?from=rebuild" className="link">
              Plus
            </Link>
            .
          </p>
        )}
      </div>
      {changed ? <p className="text-sm text-ink-muted">Switching builds a fresh 12-week plan. Your drawings and progress stay.</p> : null}
      {error ? (
        <p className="text-accent-deep" role="alert">
          {error.message}{" "}
          {error.paywall ? (
            <Link href="/upgrade" className="link font-semibold">
              See Plus
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
