"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";

import {
  fetchExecutorsDirectory,
  type ExecutorDirectoryEntry,
} from "@/lib/api";
import {
  displayExecutorType,
  formatEarnedMicros,
  formatTasksLabel,
  glyphForExecutorType,
  hashHueFromId,
  ratePercentFromBps,
} from "@/lib/executor-format";

function typeBadgeStyle(dbType: string): { color: string; label: string } {
  const s = dbType.toLowerCase();
  if (s === "human")
    return {
      color: "oklch(0.78 0.18 240)",
      label: displayExecutorType(dbType),
    };
  if (s === "robot")
    return {
      color: "oklch(0.78 0.18 295)",
      label: displayExecutorType(dbType),
    };
  return { color: "var(--accent)", label: displayExecutorType(dbType) };
}

function buildDescription(e: ExecutorDirectoryEntry): string {
  const caps = e.capabilities;
  if (Array.isArray(caps) && caps.length > 0) {
    return caps.slice(0, 3).join(" · ");
  }
  const regs = e.regions;
  if (Array.isArray(regs) && regs.length > 0) {
    return `Regions: ${regs.slice(0, 2).join(", ")}`;
  }
  return "Registered executor on Agent Zero.";
}

function tagsFor(e: ExecutorDirectoryEntry): string[] {
  const out: string[] = [];
  if (Array.isArray(e.capabilities)) out.push(...e.capabilities.slice(0, 4));
  if (Array.isArray(e.specialties)) {
    for (const s of e.specialties) {
      if (typeof s === "string") out.push(s);
      else if (s != null) out.push(String(s));
    }
  }
  const unique = [...new Set(out)].slice(0, 6);
  if (unique.length > 0) return unique;
  return [displayExecutorType(e.type)];
}

function useSpot() {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = (ev: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
    el.style.setProperty("--my", `${ev.clientY - r.top}px`);
  };
  return { ref, onMouseMove };
}

function AgentCard({ e, index }: { e: ExecutorDirectoryEntry; index: number }) {
  const { ref, onMouseMove } = useSpot();
  const ts = typeBadgeStyle(e.type);
  const hue = hashHueFromId(e.executor_id);
  const ring = `oklch(0.78 0.2 ${hue})`;
  const stats = {
    tasks: formatTasksLabel(e.tasks_completed),
    rate: ratePercentFromBps(e.rating_bps) ?? "—",
    earned: formatEarnedMicros(e.total_earned_micros),
  };
  const desc = buildDescription(e);
  const caps = tagsFor(e);

  return (
    <Link href={`/profile/${e.executor_id}`} className="group block min-w-0">
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
                background: `conic-gradient(from ${hue}deg, ${ring}, oklch(0.7 0.2 ${(hue + 90) % 360}), ${ring})`,
                color: "var(--bg)",
              }}
            >
              <span aria-hidden>{glyphForExecutorType(e.type)}</span>
            </div>
            <span
              className="live-dot absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[color:var(--card)] bg-[color:var(--accent)]"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]"
              style={{
                fontFamily:
                  "var(--font-instrument-serif), ui-serif, Georgia, serif",
              }}
            >
              {e.display_name}
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
        <p className="mb-4 line-clamp-2 text-[13px] leading-[1.5] text-[color:var(--ink-2)]">
          {desc}
        </p>
        <div className="mb-4 flex w-full min-w-0 gap-2">
          {(
            [
              ["Tasks", stats.tasks],
              ["Rate", stats.rate],
              ["Earned", stats.earned],
            ] as const
          ).map(([label, val]) => (
            <div
              key={label}
              className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center rounded-[10px] border border-[color:var(--line-2)] bg-[color:var(--bg-2)] px-1.5 py-2.5 text-center sm:px-2"
            >
              <div
                className="w-full truncate text-[14px] font-normal tabular-nums text-[color:var(--ink)] sm:text-[15px]"
                style={{
                  fontFamily:
                    "var(--font-instrument-serif), ui-serif, Georgia, serif",
                }}
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
          {caps.map((c) => (
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
  const [typeFilter, setTypeFilter] = useState<
    "all" | "human" | "agent" | "robot"
  >("all");

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["executors-directory", typeFilter],
    queryFn: () => fetchExecutorsDirectory({ type: typeFilter, limit: 100 }),
  });

  const rows = data?.executors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All types"],
            ["human", "Human"],
            ["agent", "Agent"],
            ["robot", "Robot"],
          ] as const
        ).map(([id, label]) => {
          const on = typeFilter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`rounded-full border px-3.5 py-2.5 text-xs font-semibold transition ${
                on
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--bg)]"
                  : "border-[color:var(--line)] bg-transparent text-[color:var(--ink-2)] hover:bg-[color:var(--bg-2)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isPending && (
        <p className="text-sm text-[color:var(--mute)]" aria-live="polite">
          Loading executors…
        </p>
      )}

      {isError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {error instanceof Error ? error.message : "Failed to load executors"}
        </p>
      )}

      {!isPending && !isError && rows.length === 0 && (
        <p className="text-sm text-[color:var(--mute)]">
          No registered executors yet.
        </p>
      )}

      {!isPending && !isError && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((e, i) => (
            <AgentCard key={e.executor_id} e={e} index={i} />
          ))}
        </div>
      )}

      {!isPending && !isError && (
        <p className="text-xs text-[color:var(--mute)]">
          Directory loads from{" "}
          <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[11px] text-[color:var(--ink)]">
            GET /api/v1/executors
          </code>{" "}
          (live{" "}
          <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[11px] text-[color:var(--ink)]">
            executors
          </code>{" "}
          rows).
        </p>
      )}
    </div>
  );
}
