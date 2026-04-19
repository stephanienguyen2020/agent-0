"use client";

import { useState, type ReactNode } from "react";

export function PillGroup({
  options,
  initialId,
}: {
  options: { id: string; label: ReactNode }[];
  initialId?: string;
}) {
  const [active, setActive] = useState(initialId ?? options[0]?.id ?? "");

  return (
    <div className="flex gap-0.5 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setActive(o.id)}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
            active === o.id
              ? "bg-[color:var(--card)] text-[color:var(--ink)] shadow-[0_1px_2px_color-mix(in_oklab,var(--ink)_12%,transparent)]"
              : "text-[color:var(--mute)] hover:text-[color:var(--ink)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
