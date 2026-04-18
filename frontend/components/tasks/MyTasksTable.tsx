"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { CategoryPill, StatusPill } from "@/components/ui/TaskChips";
import type { TaskRow } from "@/components/tasks/TasksMarket";
import { explorerTxUrl, shortTxHash } from "@/lib/explorer";

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
  if (tab === "in_progress") return s === "in_progress" || s === "accepted" || s === "submitted" || s === "verifying";
  if (tab === "completed") return s === "completed";
  if (tab === "disputed") return s === "disputed";
  return true;
}

export function MyTasksTable({ tasks }: { tasks: TaskRow[] }) {
  const [tab, setTab] = useState<TabId>("all");

  const counts = useMemo(() => {
    const c: Record<TabId, number> = {
      all: tasks.length,
      published: 0,
      in_progress: 0,
      completed: 0,
      disputed: 0,
    };
    for (const t of tasks) {
      const s = t.status.toLowerCase();
      if (s === "published") c.published += 1;
      if (s === "completed") c.completed += 1;
      if (s === "disputed") c.disputed += 1;
      if (["in_progress", "accepted", "submitted", "verifying"].includes(s)) c.in_progress += 1;
    }
    return c;
  }, [tasks]);

  const filtered = useMemo(
    () => tasks.filter((t) => tabFilter(tab, t.status)),
    [tasks, tab],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
    { id: "disputed", label: "Disputed" },
  ];

  return (
    <>
      <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-2xl border border-az-stroke bg-white/[0.03] p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[13px] font-semibold transition ${
              tab === x.id
                ? "border-white/[0.08] bg-white/[0.06] text-white"
                : "border-transparent text-az-muted-2 hover:text-az-text"
            }`}
          >
            {x.label}
            <span
              className={`rounded-full px-[7px] py-0.5 text-[10px] font-bold ${
                tab === x.id ? "bg-az-green text-[#0d1a0f]" : "bg-white/[0.08]"
              }`}
            >
              {counts[x.id]}
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="min-w-[720px]">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_100px] gap-3 border-b border-az-stroke px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          <span>Task</span>
          <span>Category</span>
          <span>Bounty</span>
          <span>Status</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>
        {filtered.map((t, i) => (
          <div
            key={t.task_id}
            className="relative grid min-w-[720px] grid-cols-[2.5fr_1fr_1fr_1fr_1fr_100px] items-center gap-3 border-b border-az-stroke px-5 py-4 text-sm transition hover:bg-white/[0.02] az-animate-fade-up"
            style={{ animationDelay: `${Math.min(i * 0.03, 0.25)}s` }}
          >
            <Link
              href={`/tasks/${t.task_id}`}
              className="absolute inset-0 z-0"
              aria-label={`Open task ${t.title}`}
            />
            <div className="relative z-10 min-w-0 pointer-events-none">
              <div className="truncate font-semibold text-az-text">{t.title}</div>
              <div className="az-mono text-[10px] text-az-muted">EM-{String(t.task_id).slice(0, 6)}…</div>
            </div>
            <div className="relative z-10 pointer-events-none">
              <CategoryPill category={t.category} />
            </div>
            <div className="relative z-10 font-bold tabular-nums text-[#cdf56a] pointer-events-none">
              ${formatBounty(t.bounty_micros)} <span className="text-[10px] font-medium text-az-muted-2">USDC</span>
            </div>
            <div className="relative z-10 pointer-events-none">
              <StatusPill status={t.status} />
            </div>
            <div className="relative z-10 min-w-0 text-xs text-az-muted-2">
              <div className="tabular-nums pointer-events-none">{formatUpdated(t.updated_at)}</div>
              {t.status?.toLowerCase() === "completed" &&
              (t.on_chain_tx_release || t.on_chain_tx_publish) ? (
                <button
                  type="button"
                  title={t.on_chain_tx_release || t.on_chain_tx_publish || undefined}
                  className="relative z-20 mt-0.5 block max-w-full truncate text-left az-mono text-[10px] text-[#cdf56a] underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(
                      explorerTxUrl((t.on_chain_tx_release || t.on_chain_tx_publish)!),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  {shortTxHash((t.on_chain_tx_release || t.on_chain_tx_publish)!)}
                </button>
              ) : null}
            </div>
            <div className="relative z-10 flex justify-end gap-1 pointer-events-none">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-az-stroke-2 bg-white/[0.04] text-az-muted-2">
                →
              </span>
            </div>
          </div>
        ))}
        </div>
      </Card>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-az-muted-2">No tasks in this tab.</p>
      )}
    </>
  );
}
