"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CategoryPill } from "@/components/ui/TaskChips";
import { Card } from "@/components/ui/Card";
import { IconPlus } from "@/components/ui/Button";
import { formatCategoryLabel } from "@/lib/task-styles";

export type TaskRow = {
  task_id: string;
  title: string;
  category: string;
  status: string;
  bounty_micros?: string | number;
  instructions?: string;
};

function formatBounty(micros: string | number | undefined) {
  if (micros == null) return "—";
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (Number.isNaN(n)) return String(micros);
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function TasksMarket({ tasks }: { tasks: TaskRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | "all">("all");

  const categories = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => s.add(t.category));
    return Array.from(s);
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchQ =
        !q.trim() ||
        t.title.toLowerCase().includes(q.toLowerCase()) ||
        String(t.task_id).toLowerCase().includes(q.toLowerCase());
      const matchC = cat === "all" || t.category === cat;
      return matchQ && matchC;
    });
  }, [tasks, q, cat]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <div className="flex min-h-[44px] min-w-[200px] flex-1 items-center gap-2.5 rounded-[14px] border border-az-stroke-2 bg-white/[0.04] px-4">
          <svg className="h-4 w-4 shrink-0 text-az-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-az-text placeholder:text-az-muted outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setCat("all")}
          className={`flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[14px] border px-3.5 text-xs font-semibold transition ${
            cat === "all"
              ? "border-[rgba(182,242,74,0.3)] bg-[rgba(182,242,74,0.06)] text-[#cdf56a]"
              : "border-az-stroke-2 bg-white/[0.04] text-az-muted-2 hover:border-white/[0.15] hover:text-az-text"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[14px] border px-3.5 text-xs font-semibold transition ${
              cat === c
                ? "border-[rgba(182,242,74,0.3)] bg-[rgba(182,242,74,0.06)] text-[#cdf56a]"
                : "border-az-stroke-2 bg-white/[0.04] text-az-muted-2 hover:border-white/[0.15] hover:text-az-text"
            }`}
          >
            {formatCategoryLabel(c)}
          </button>
        ))}
        <Link
          href="/my-tasks"
          className="ml-auto inline-flex h-11 items-center gap-2 rounded-[14px] bg-az-btn-green px-5 text-[13px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px hover:shadow-[0_12px_30px_-8px_rgba(180,240,90,0.55)]"
        >
          <IconPlus className="h-4 w-4" />
          Post task
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t, i) => (
          <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="block">
            <Card
              className={`relative cursor-pointer overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] az-animate-fade-up`}
              style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
            >
              <div className="absolute right-0 top-0 h-[60px] w-[60px] overflow-hidden">
                <span className="absolute right-[-18px] top-3 rotate-45 bg-az-green px-6 py-0.5 text-[8px] font-extrabold tracking-wide text-[#0d1a0f]">
                  LIVE
                </span>
              </div>
              <div className="mb-3 flex items-start justify-between gap-2">
                <CategoryPill category={t.category} />
              </div>
              <div className="mb-1 text-lg font-extrabold tabular-nums text-[#cdf56a]">
                {formatBounty(t.bounty_micros)} <span className="text-[11px] font-medium text-az-muted-2">USDC</span>
              </div>
              <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-snug text-az-text">{t.title}</h3>
              <p className="mb-3.5 line-clamp-2 text-xs leading-relaxed text-az-muted-2">
                {t.instructions || "No description."}
              </p>
              <div className="mt-3.5 flex items-center justify-between border-t border-az-stroke pt-3.5">
                <span className="text-[10px] text-az-muted">ID {String(t.task_id).slice(0, 8)}…</span>
                <span className="text-[11px] font-medium capitalize text-az-muted-2">{t.status.replace(/_/g, " ")}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-az-muted-2">No tasks match your filters.</p>
      )}
    </>
  );
}
