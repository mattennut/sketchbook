"use client";

import { Check } from "lucide-react";
import { EQUIPMENT, type EquipmentId } from "@/lib/skills";

const GROUPS: { id: (typeof EQUIPMENT)[number]["group"]; title: string }[] = [
  { id: "traditional", title: "Drawing" },
  { id: "paint", title: "Paint" },
  { id: "digital", title: "Digital" },
];

/** Multi-select of drawing tools, grouped. Real checkboxes for keyboard and screen readers. */
export function EquipmentPicker({
  value,
  onChange,
}: {
  value: EquipmentId[];
  onChange: (next: EquipmentId[]) => void;
}) {
  const toggle = (id: EquipmentId) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="grid gap-7">
      {GROUPS.map((g) => (
        <fieldset key={g.id}>
          <legend className="eyebrow mb-3">{g.title}</legend>
          <div className="flex flex-wrap gap-2.5">
            {EQUIPMENT.filter((e) => e.group === g.id).map((e) => {
              const on = value.includes(e.id);
              return (
                <label
                  key={e.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-[0.98rem] transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    on ? "border-accent bg-accent-wash font-semibold" : "border-rule bg-sheet hover:border-rule-strong"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(e.id)} />
                  <span
                    className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border ${
                      on ? "border-accent bg-accent text-sheet" : "border-rule-strong"
                    }`}
                    aria-hidden="true"
                  >
                    {on ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  {e.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
