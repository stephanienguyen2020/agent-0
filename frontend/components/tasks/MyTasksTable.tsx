"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCategoryLabel } from "@/lib/task-styles";
import type { TaskRow } from "@/components/tasks/TasksMarket";
import { explorerTxUrl, shortTxHash } from "@/lib/explorer";

const CAT_META: Record<string, { hue: number; glyph: string }> = {
  presence:  { hue: 145, glyph: "◉" },
  knowledge: { hue: 240, glyph: "▤" },
  authority: { hue: 75,  glyph: "✱" },
  action:    { hue: 20,  glyph: "→" },
  agent:     { hue: 295, glyph: "◐" },
  verify:    { hue: 175, glyph: "✓" },
};

function catMeta(cat: string) {
  return CAT_META[cat] ?? { hue: 145, glyph: "•" };
}

function taskCatalogRef(taskId: string) {
  const c = String(taskId).replace(/-/g, "");
  const tail = c.slice(-4);
  return (tail.length >= 4 ? tail : c.slice(0, 4)).toUpperCase();
}

function formatBounty(micros: string | number | undefined) {
  if (micros == null) return "—";
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (Number.isNaN(n)) return String(micros);
  return (n / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUpdated(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

type TabId = "all" | "published" | "in_progress" | "completed" | "disputed";

function tabFilter(tab: TabId, status: string) {
  const s = status.toLowerCase();
  if (tab === "all") return true;
  if (tab === "published") return s === "published";
  if (tab === "in_progress") return ["in_progress", "accepted", "submitted", "verifying"].includes(s);
  if (tab === "completed") return s === "completed";
  if (tab === "disputed") return s === "disputed";
  return true;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed") return "var(--accent)";
  if (s === "disputed") return "var(--danger)";
  if (["in_progress", "accepted", "submitted", "verifying"].includes(s)) return "oklch(0.82 0.09 240)";
  return "var(--mute)";
}

/* ── Status pill ── */
function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="az-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] capitalize"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 28%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Category badge ── */
function CatBadge({ cat }: { cat: string }) {
  const { hue, glyph } = catMeta(cat);
  return (
    <span
      className="az-mono inline-flex max-w-full items-center gap-1.5 whitespace-normal break-words rounded-full px-2.5 py-1 text-[11px] sm:whitespace-nowrap"
      style={{
        color: `oklch(0.82 0.09 ${hue})`,
        background: `color-mix(in oklab, oklch(0.82 0.09 ${hue}) 16%, transparent)`,
        border: `1px solid color-mix(in oklab, oklch(0.82 0.09 ${hue}) 30%, transparent)`,
      }}
    >
      {glyph} {formatCategoryLabel(cat)}
    </span>
  );
}

function TaskCardMobile({ t, delayMs }: { t: TaskRow; delayMs: number }) {
  const ref = taskCatalogRef(t.task_id);
  return (
    <Link
      href={`/tasks/${t.task_id}`}
      className="dashboard-reveal block rounded-[12px] border border-[color:var(--line)] bg-[color:var(--card)] p-4 shadow-[var(--shadow-soft)] transition [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] active:scale-[0.99] md:hidden"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-serif text-[22px] leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            {ref.slice(0, 2)}
            <span className="text-[13px]" style={{ color: "var(--mute)" }}>
              {ref.slice(2, 4)}
            </span>
          </div>
          <div className="az-mono mt-1 text-[10px]" style={{ color: "var(--mute)" }}>
            ref · catalog
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-serif text-[22px] leading-none tabular-nums" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            ${formatBounty(t.bounty_micros)}
          </div>
          <div className="az-mono text-[10px]" style={{ color: "var(--mute)" }}>
            USDC
          </div>
        </div>
      </div>
      <div className="mb-2 text-[15px] font-medium leading-snug" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
        {t.title}
      </div>
      <div className="az-mono mb-3 line-clamp-1 text-[11px]" style={{ color: "var(--mute)" }}>
        id {String(t.task_id).slice(0, 14)}
        {String(t.task_id).length > 14 ? "…" : ""}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CatBadge cat={t.category} />
        <StatusPill status={t.status} />
      </div>
      <div className="az-mono mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-[color:var(--mute)]">
        Open task <span aria-hidden>→</span>
      </div>
    </Link>
  );
}

/* ── Main table ── */
export function MyTasksTable({ tasks }: { tasks: TaskRow[] }) {
  const [tab, setTab] = useState<TabId>("all");

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: tasks.length, published: 0, in_progress: 0, completed: 0, disputed: 0 };
    for (const t of tasks) {
      const s = t.status.toLowerCase();
      if (s === "published") c.published += 1;
      if (s === "completed") c.completed += 1;
      if (s === "disputed") c.disputed += 1;
      if (["in_progress", "accepted", "submitted", "verifying"].includes(s)) c.in_progress += 1;
    }
    return c;
  }, [tasks]);

  const filtered = useMemo(() => tasks.filter((t) => tabFilter(tab, t.status)), [tasks, tab]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "all",         label: "All" },
    { id: "published",   label: "Published" },
    { id: "in_progress", label: "In progress" },
    { id: "completed",   label: "Completed" },
    { id: "disputed",    label: "Disputed" },
  ];

  return (
    <div className="min-w-0">
      {/* Tabs */}
      <div
        className="dashboard-reveal -mx-1 mb-5 max-w-full overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="inline-flex w-max flex-nowrap gap-0.5 rounded-full p-1 sm:flex-wrap sm:w-fit"
          style={{ border: "1px solid var(--line)", background: "var(--card)" }}
        >
        {tabs.map((x) => {
          const on = tab === x.id;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className="dashboard-btn flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition sm:gap-2 sm:px-4 sm:text-[13px]"
              style={{
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--bg)" : "var(--ink-2)",
                border: "none",
              }}
            >
              {x.label}
              <span
                className="az-mono rounded-full px-[7px] py-px text-[10px] font-semibold tabular-nums"
                style={{
                  background: on ? "var(--bg)" : "color-mix(in oklab, var(--line) 55%, transparent)",
                  color: on ? "var(--ink)" : "var(--mute)",
                }}
              >
                {counts[x.id]}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((t, i) => (
          <TaskCardMobile key={t.task_id} t={t} delayMs={Math.min(i * 25, 250)} />
        ))}
      </div>

      {/* Table — desktop */}
      <div className="dashboard-reveal dashboard-reveal-d2 hidden overflow-x-auto md:block">
        <div className="min-w-[720px] lg:min-w-[820px]">
          <div
            className="az-mono grid items-center gap-4 px-4 py-3 text-[10.5px] uppercase lg:gap-6 lg:px-[18px]"
            style={{
              gridTemplateColumns: "72px 2fr 1fr 1fr 1fr 64px",
              borderBottom: "1px solid var(--line)",
              color: "var(--mute)",
              letterSpacing: "0.12em",
            }}
          >
            <span>Ref</span>
            <span>Task</span>
            <span>Category</span>
            <span>Bounty</span>
            <span>Status</span>
            <span className="text-right"> </span>
          </div>

          {filtered.map((t, i) => {
            const ref = taskCatalogRef(t.task_id);
            const completedTx =
              t.status?.toLowerCase() === "completed"
                ? t.on_chain_tx_release || t.on_chain_tx_publish
                : null;
            return (
              <Link
                key={t.task_id}
                href={`/tasks/${t.task_id}`}
                className="task-row grid items-center gap-4 px-4 py-4 dashboard-reveal lg:gap-6 lg:px-[18px] lg:py-[22px]"
                style={{
                  gridTemplateColumns: "72px 2fr 1fr 1fr 1fr 64px",
                  borderBottom: "1px solid var(--line-2)",
                  animationDelay: `${Math.min(i * 25, 250)}ms`,
                }}
              >
                <div className="min-w-0">
                  <div className="font-serif text-[22px] leading-none lg:text-[26px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
                    {ref.slice(0, 2)}
                    <span className="text-[13px] lg:text-[14px]" style={{ color: "var(--mute)" }}>
                      {ref.slice(2, 4)}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium leading-snug lg:text-[15px]" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
                    {t.title}
                  </div>
                  <div className="az-mono mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--mute)" }}>
                    id {String(t.task_id).slice(0, 12)}
                    {String(t.task_id).length > 12 ? "…" : ""}
                  </div>
                </div>
                <div className="min-w-0">
                  <CatBadge cat={t.category} />
                </div>
                <div className="min-w-0 text-left">
                  <span className="font-serif text-[20px] leading-none lg:text-[24px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
                    ${formatBounty(t.bounty_micros)}
                  </span>
                  <span className="az-mono ml-1 block text-[10px] lg:inline" style={{ color: "var(--mute)" }}>
                    USDC
                  </span>
                </div>
                <div className="min-w-0">
                  <StatusPill status={t.status} />
                  {completedTx ? (
                    <button
                      type="button"
                      title={completedTx}
                      className="az-mono mt-1 block max-w-full truncate text-left text-[10px] text-[color:var(--accent)] underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(explorerTxUrl(completedTx), "_blank", "noopener,noreferrer");
                      }}
                    >
                      {shortTxHash(completedTx)}
                    </button>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  <span
                    className="arrow dashboard-btn inline-flex h-9 w-9 items-center justify-center rounded-full text-sm"
                    style={{ border: "1px solid var(--line)", color: "var(--mute)" }}
                  >
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="az-mono py-10 text-center text-[13px]" style={{ color: "var(--mute)" }}>
          No tasks in this tab.
        </p>
      )}
    </div>
  );
}

function StepCircle({
  s,
}: {
  s: { n: string; label: string; state: "done" | "active" | "todo" };
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <div
        className="az-mono mb-2 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
        style={{
          border: `2px solid ${s.state !== "todo" ? "var(--accent)" : "var(--line)"}`,
          background:
            s.state === "done"
              ? "var(--accent)"
              : s.state === "active"
                ? "color-mix(in oklab, var(--accent) 18%, transparent)"
                : "transparent",
          color: s.state === "done" ? "var(--bg)" : s.state === "active" ? "var(--accent)" : "var(--mute)",
        }}
      >
        {s.n}
      </div>
      <div
        className="az-mono max-w-[6.5rem] text-[9px] font-semibold leading-tight sm:text-[10px]"
        style={{ color: s.state !== "todo" ? "var(--accent)" : "var(--mute)" }}
      >
        {s.label}
      </div>
    </div>
  );
}

/* ── Lifecycle progress bar ── */
export function LifecycleBar() {
  const steps = [
    { n: "✓", label: "Published",   state: "done"   as const },
    { n: "✓", label: "Accepted",    state: "done"   as const },
    { n: "✓", label: "In progress", state: "done"   as const },
    { n: "4", label: "Submitted",   state: "active" as const },
    { n: "5", label: "Verifying",   state: "todo"   as const },
    { n: "6", label: "Completed",   state: "todo"   as const },
  ];

  return (
    <div
      className="dashboard-reveal mb-6 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-4 shadow-[var(--shadow-soft)] sm:px-5 sm:py-5"
    >
      {/* Mobile / tablet: 3×2 grid */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-6 lg:hidden">
        {steps.map((s) => (
          <StepCircle key={s.label} s={s} />
        ))}
      </div>

      {/* Desktop: horizontal with connectors */}
      <div className="hidden min-w-0 items-center lg:flex">
        {steps.map((s, i) => (
          <div key={s.label} className="flex min-w-[72px] flex-1 items-center">
            <StepCircle s={s} />
            {i < steps.length - 1 && (
              <div
                className="mb-5 h-0.5 w-6 shrink-0 xl:w-10"
                style={{ background: i < 3 ? "var(--accent)" : "var(--line)" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
