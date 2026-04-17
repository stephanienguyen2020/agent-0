"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

/**
 * Hero / feature card with Dashboard.html-style glows: mouse-tracking spot,
 * fixed accent radial blob, rim highlight, and optional outer bloom via .editorial-hero-card.
 */
export function EditorialHeroCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className="spot dashboard-reveal dashboard-reveal-d2 editorial-hero-card relative overflow-hidden rounded-[12px] border border-[color:var(--line)] bg-[color:var(--card)] p-6 sm:p-7"
    >
      <div
        aria-hidden
        data-spot-decor
        className="pointer-events-none absolute -right-20 -top-20 z-0 h-80 w-80 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
