"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usesPenTablet, type EquipmentId } from "@/lib/skills";
import { EquipmentPicker } from "../equipment-picker";

export function EquipmentSettings({ initial }: { initial: EquipmentId[] }) {
  const [value, setValue] = useState<EquipmentId[]>(initial);
  const [saved, setSaved] = useState<EquipmentId[]>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const router = useRouter();
  const dirty = [...value].sort().join() !== [...saved].sort().join();

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ equipment: value }),
      });
      if (!res.ok) throw new Error();
      setSaved(value);
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-5">
      <EquipmentPicker
        value={value}
        onChange={(v) => {
          setValue(v);
          setStatus("idle");
        }}
      />
      <p className="text-sm text-ink-muted">
        {usesPenTablet(value)
          ? "Lessons open with a two-minute pen warm-up (you can skip it any time)."
          : "Add a graphic tablet or stylus tablet to get a pen warm-up before each lesson."}
      </p>
      <div className="flex items-center gap-4">
        <button className="btn btn-secondary" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save equipment"}
        </button>
        <span className="text-sm text-ink-muted" role="status">
          {status === "saved" ? "Saved." : status === "error" ? "Couldn't save — try again." : ""}
        </span>
      </div>
    </div>
  );
}
