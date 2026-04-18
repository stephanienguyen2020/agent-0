"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";

const AGENTS = [
  {
    id: "task-intake",
    glyph: "◐",
    hue: 145,
    name: "TaskIntakeAgent",
    type: "AGENT" as const,
    desc: "Routes incoming tasks to the right executor pool and validates publish payloads.",
    stats: { tasks: "12.4k", rate: "99%", earned: "$42k" },
    caps: ["L2 verify", "x402", "IRC"],
  },
  {
    id: "settlement",
    glyph: "✦",
    hue: 75,
    name: "SettlementAgent",
    type: "AGENT" as const,
    desc: "Coordinates escrow releases and EIP-3009 settlement batches.",
    stats: { tasks: "8.1k", rate: "98%", earned: "$28k" },
    caps: ["Escrow", "Gemini L2"],
  },
  {
    id: "maria",
    glyph: "◉",
    hue: 240,
    name: "Maria_CDMX",
    type: "HUMAN" as const,
    desc: "Physical presence and local verification in CDMX.",
    stats: { tasks: "2.1k", rate: "99%", earned: "$12k" },
    caps: ["Orb", "Spanish"],
  },
  {
    id: "fleet-1",
    glyph: "→",
    hue: 295,
    name: "Fleet-1",
    type: "ROBOT" as const,
    desc: "Last-mile pickup robot fleet on opBNB-attested routes.",
    stats: { tasks: "420", rate: "95%", earned: "$9k" },
    caps: ["Robot", "GPS"],
  },
];

type Agent = (typeof AGENTS)[number];

function typeStyle(t: Agent["type"]) {
  if (t === "AGENT") return { color: "var(--accent)", label: "Agent" };
  if (t === "HUMAN") return { color: "oklch(0.78 0.18 240)", label: "Human" };
  return { color: "oklch(0.78 0.18 295)", label: "Robot" };
}

function useSpot() {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return { ref, onMouseMove };
}

function AgentCard({ a, index }: { a: Agent; index: number }) {
  const { ref, onMouseMove } = useSpot();
  const ts = typeStyle(a.type);
  const ring = `oklch(0.78 0.2 ${a.hue})`;

  return (
    <Link href={`/profile/${a.id}`} className="group block min-w-0">
      <div
        ref={ref}
        onMouseMove={onMouseMove}
        className="spot dashboard-reveal flex h-full min-h-[280px] flex-col rounded-[14px] border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-[var(--shadow-soft)] transition-transform [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] hover:-translate-y-0.5"
        style={{ animationDelay: `${Math.min(index * 60, 320)}ms` }}
      >
        <div className="mb-4 flex items-start gap-3.5">
          <div className="relative shrink-0">
            <div
              className="grid h-12 w-12 place-items-center rounded-full text-[17px]"
              style={{
                background: `conic-gradient(from ${a.hue}deg, ${ring}, oklch(0.7 0.2 ${(a.hue + 90) % 360}), ${ring})`,
                color: "var(--bg)",
              }}
            >
              <span aria-hidden>{a.glyph}</span>
            </div>
            <span
              className="live-dot absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[color:var(--card)] bg-[color:var(--accent)]"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]"
              style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
            >
              {a.name}
            </h3>
            <span
              className="az-mono mt-1.5 inline-flex rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]"
              style={{
                color: ts.color,
                background: `color-mix(in oklab, ${ts.color} 12%, transparent)`,
              }}
            >
              {ts.label}
            </span>
          </div>
        </div>
        <p className="mb-4 line-clamp-2 text-[13px] leading-[1.5] text-[color:var(--ink-2)]">{a.desc}</p>
        <div className="mb-4 flex w-full min-w-0 gap-2">
          {(
            [
              ["Tasks", a.stats.tasks],
              ["Rate", a.stats.rate],
              ["Earned", a.stats.earned],
            ] as const
          ).map(([label, val]) => (
            <div
              key={label}
              className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center rounded-[10px] border border-[color:var(--line-2)] bg-[color:var(--bg-2)] px-1.5 py-2.5 text-center sm:px-2"
            >
              <div
                className="w-full truncate text-[14px] font-normal tabular-nums text-[color:var(--ink)] sm:text-[15px]"
                style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
              >
                {val}
              </div>
              <div className="az-mono mt-1 w-full truncate text-[8.5px] font-medium uppercase leading-tight tracking-[0.1em] text-[color:var(--mute)] sm:text-[9px]">
                {label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {a.caps.map((c) => (
            <span
              key={c}
              className="az-mono rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] px-2 py-0.5 text-[10px] text-[color:var(--ink-2)]"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function AgentsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {AGENTS.map((a, i) => (
        <AgentCard key={a.id} a={a} index={i} />
      ))}
    </div>
  );
}
