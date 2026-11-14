"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function UpgradeButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error?.message ?? "Checkout didn't start.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout didn't start.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <button className="btn btn-primary text-lg" onClick={go} disabled={busy} aria-busy={busy}>
        {busy ? "Opening secure checkout…" : label}
        {!busy ? <ArrowRight size={18} aria-hidden="true" /> : null}
      </button>
      {error ? (
        <p className="text-accent-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
