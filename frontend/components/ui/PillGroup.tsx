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
    <div className="flex gap-0.5 rounded-full border border-az-stroke bg-white/[0.04] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setActive(o.id)}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
            active === o.id ? "bg-white/[0.08] text-white" : "text-az-muted-2 hover:text-az-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
