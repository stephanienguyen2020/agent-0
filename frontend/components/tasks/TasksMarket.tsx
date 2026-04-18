"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { formatCategoryLabel } from "@/lib/task-styles";

export type TaskRow = {
  task_id: string;
  title: string;
  category: string;
  status: string;
  bounty_micros?: string | number;
  instructions?: string;
  updated_at?: string | null;
  on_chain_tx_release?: string | null;
  on_chain_tx_publish?: string | null;
};

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

function formatBounty(micros: string | number | undefined) {
  if (micros == null) return "—";
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (Number.isNaN(n)) return String(micros);
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function totalPool(tasks: TaskRow[]) {
  return tasks.reduce((s, t) => {
    const n = t.bounty_micros == null ? 0 : Number(t.bounty_micros) / 1_000_000;
    return s + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

/** Compact ref for the editorial “catalog” column (API task id, no mock content). */
function taskCatalogRef(taskId: string) {
  const c = String(taskId).replace(/-/g, "");
  const tail = c.slice(-4);
  return (tail.length >= 4 ? tail : c.slice(0, 4)).toUpperCase();
}

const STATUS_SORT_RANK: Record<string, number> = {
  published: 0,
  in_progress: 1,
  accepted: 2,
  submitted: 3,
  verifying: 4,
  completed: 5,
  disputed: 6,
};

function statusSortRank(status: string) {
  return STATUS_SORT_RANK[status.toLowerCase()] ?? 50;
}

/* ── Category badge ── */
function CatBadge({ cat }: { cat: string }) {
  const { hue, glyph } = catMeta(cat);
  return (
    <span
      className="az-mono inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]"
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

/* ── Grid task card ── */
function TaskCard({ task, onOpen }: { task: TaskRow; onOpen: (t: TaskRow) => void }) {
  const bounty = formatBounty(task.bounty_micros);
  const ref = taskCatalogRef(task.task_id);
  const topStripe =
    task.status === "disputed"
      ? "var(--danger)"
      : task.status === "published"
        ? "var(--accent)"
        : "transparent";

  return (
    <div
      onClick={() => onOpen(task)}
      className="dashboard-btn spot relative flex h-full min-h-0 w-full cursor-pointer flex-col gap-3 overflow-hidden rounded-[14px] px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4"
      style={{
        border: "1px solid var(--line)",
        background: "var(--card)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-0"
        style={{ height: 2, background: topStripe }}
      />

      <div className="flex shrink-0 items-start justify-between gap-2">
        <CatBadge cat={task.category} />
        {task.status === "published" && (
          <span
            className="az-mono inline-flex shrink-0 items-center gap-1.5 text-[10.5px]"
            style={{ color: "var(--accent)" }}
          >
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            live
          </span>
        )}
      </div>

      {/* Grows to fill row height so dashed rule + footer align across cards in the same row. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
          <h3 className="mb-1 line-clamp-2 text-[15px] font-medium leading-snug sm:text-[16px]" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {task.title}
          </h3>
          <p className="az-mono line-clamp-1 text-[10.5px] sm:text-[11px]" style={{ color: "var(--mute)" }}>
            ref {ref} · {task.status.replace(/_/g, " ")}
          </p>
        </div>
        <p
          className="mt-2 min-h-[3.6rem] flex-1 line-clamp-3 text-[12px] leading-[1.5] sm:min-h-[3.75rem] sm:text-[12.5px]"
          style={{ color: "var(--ink-2)" }}
        >
          {task.instructions || "No description."}
        </p>
      </div>

      <div
        className="flex shrink-0 flex-col gap-3 border-t border-dashed pt-3 min-[380px]:flex-row min-[380px]:items-end min-[380px]:justify-between"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="min-w-0">
          <div
            className="az-mono mb-1 text-[10px] uppercase"
            style={{ color: "var(--mute)", letterSpacing: "0.14em" }}
          >
            Bounty
          </div>
          <div className="font-serif text-[26px] leading-none sm:text-[28px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            ${bounty}
            <span className="az-mono ml-1.5 text-[10px]" style={{ color: "var(--mute)" }}>USDC</span>
          </div>
        </div>
        <span
          className="az-mono w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] capitalize min-[380px]:self-end"
          style={{ color: "var(--mute)", border: "1px solid var(--line)" }}
        >
          {task.status.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

/* ── List task row — design.md §6.3 grid; data from API only ── */
function TaskRowItem({ task, onOpen }: { task: TaskRow; onOpen: (t: TaskRow) => void }) {
  const bounty = formatBounty(task.bounty_micros);
  const ref = taskCatalogRef(task.task_id);
  const s = task.status.toLowerCase();
  const refLineColor = s === "disputed" ? "var(--danger)" : "var(--mute)";

  return (
    <div
      onClick={() => onOpen(task)}
      className="task-row grid cursor-pointer items-center gap-6 px-[18px] py-[22px]"
      style={{
        gridTemplateColumns: "82px 1fr 180px 140px",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <div className="min-w-0">
        <div className="font-serif text-[28px] leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
          {ref.slice(0, 2)}
          <span className="text-[14px]" style={{ color: "var(--mute)" }}>
            {ref.slice(2, 4)}
          </span>
        </div>
        <div
          className="az-mono mt-1 text-[10px] uppercase"
          style={{ color: refLineColor, letterSpacing: "0.12em" }}
        >
          {task.status.replace(/_/g, " ")}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <CatBadge cat={task.category} />
        </div>
        <div className="text-[15.5px] font-medium leading-snug" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {task.title}
        </div>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-normal" style={{ color: "var(--ink-2)" }}>
          {task.instructions || "—"}
        </p>
        <div className="az-mono mt-1.5 text-[11px]" style={{ color: "var(--mute)" }}>
          id {String(task.task_id).slice(0, 10)}
          {String(task.task_id).length > 10 ? "…" : ""} · {task.status.replace(/_/g, " ")}
        </div>
      </div>

      <div className="min-w-0 text-right">
        <div
          className="az-mono mb-1 text-[10px] uppercase"
          style={{ color: "var(--mute)", letterSpacing: "0.14em" }}
        >
          Bounty
        </div>
        <div className="font-serif text-[30px] leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
          ${bounty}
        </div>
        <div className="az-mono mt-1 text-[10.5px]" style={{ color: "var(--mute)" }}>
          USDC · gasless
        </div>
      </div>

      <Link
        href={`/tasks/${task.task_id}`}
        onClick={(e) => e.stopPropagation()}
        className="dashboard-btn inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold"
        style={{ background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--accent)" }}
      >
        Accept <span className="arrow">→</span>
      </Link>
    </div>
  );
}

/* ── Stat strip ── */
function StatStrip({ tasks }: { tasks: TaskRow[] }) {
  const pool = totalPool(tasks);
  const avg = tasks.length ? Math.round(pool / tasks.length) : 0;
  const live = tasks.filter((t) => t.status === "published").length;
  const stats = [
    { label: "Open pool",   v: `$${pool.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "total bounty live" },
    { label: "Live tasks",  v: String(live),  sub: "status published" },
    { label: "Total tasks", v: String(tasks.length), sub: "in market" },
    { label: "Avg bounty",  v: `$${avg}`,     sub: "USDC per task" },
  ];
  return (
    <div className="dashboard-reveal dashboard-reveal-d1 mb-2 grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="min-w-0 rounded-[12px] px-3 py-3 sm:px-[18px] sm:py-[14px]"
          style={{ border: "1px solid var(--line)", background: "var(--card)" }}
        >
          <div
            className="az-mono mb-1.5 text-[9.5px] uppercase sm:text-[10.5px]"
            style={{ color: "var(--mute)", letterSpacing: "0.14em" }}
          >
            {s.label}
          </div>
          <div
            className="font-serif leading-none [font-size:clamp(22px,6.5vw,32px)]"
            style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}
          >
            <span className="digit-pop break-words">{s.v}</span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug sm:text-[11.5px]" style={{ color: "var(--mute)" }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Filter bar ── */
function FilterBar({
  q, setQ, cat, setCat, sort, setSort, view, setView, categories,
}: {
  q: string; setQ: (v: string) => void;
  cat: string; setCat: (v: string) => void;
  sort: string; setSort: (v: string) => void;
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
  categories: string[];
}) {
  const pillBase: CSSProperties = {
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--ink-2)",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
  const pillOn: CSSProperties = {
    ...pillBase,
    background: "var(--ink)",
    color: "var(--bg)",
  };

  return (
    <div className="dashboard-reveal dashboard-reveal-d2 flex flex-col gap-3 py-2.5 pb-[18px] sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search — body sans per design.md; metadata stays mono elsewhere */}
      <div className="relative min-w-0 flex-1 font-sans sm:flex-[0_0_280px]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search task, category…"
          className="w-full py-2.5 pl-9 pr-3 text-[13px] outline-none"
          style={{
            border: "1px solid var(--line)",
            borderRadius: 999,
            background: "var(--card)",
            color: "var(--ink)",
          }}
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          style={{ opacity: 0.45, color: "var(--ink)" }}
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5 sm:contents">
        {["all", ...categories].map((c) => {
          const on = cat === c;
          const meta = catMeta(c);
          return (
            <button key={c} onClick={() => setCat(c)} className="dashboard-btn" style={on ? pillOn : pillBase}>
              {c !== "all" && (
                <span className="az-mono" style={{ color: on ? "var(--bg)" : `oklch(0.82 0.09 ${meta.hue})` }}>
                  {meta.glyph}
                </span>
              )}
              {c === "all" ? "All" : formatCategoryLabel(c)}
            </button>
          );
        })}
      </div>

      {/* Pushes sort + view to the right on wide screens; omitted on stacked mobile layout */}
        <div className="hidden min-w-[10px] sm:block" style={{ flex: "1 1 0%" }} aria-hidden />

      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:contents">
        {/* Sort */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="az-mono text-[10.5px] uppercase" style={{ color: "var(--mute)", letterSpacing: "0.12em" }}>
            Sort
          </span>
          {(["bounty", "status", "newest"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className="dashboard-btn capitalize"
              style={sort === id ? pillOn : pillBase}
            >
              {id === "bounty" ? "Bounty" : id === "status" ? "Status" : "Newest"}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div
          className="flex shrink-0 gap-0.5 p-0.5"
          style={{ border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg-2, var(--card))" }}
        >
          {([["grid", "⊞"], ["list", "☰"]] as const).map(([id, glyph]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="dashboard-btn rounded-full px-3 py-1 text-[13px]"
              style={{
                border: "none",
                background: view === id ? "var(--card)" : "transparent",
                color: view === id ? "var(--ink)" : "var(--mute)",
              }}
            >
              {glyph}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Drawer ── */
function Drawer({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  if (!task) return null;
  const { hue, glyph } = catMeta(task.category);
  const bounty = formatBounty(task.bounty_micros);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--drawer-backdrop)",
          backdropFilter: "blur(6px)",
        }}
      />
      <div
        className="dashboard-reveal overflow-y-auto"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "min(560px, 94vw)",
          background: "var(--bg)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-7 py-5"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
        >
          <span className="az-mono text-[10.5px] uppercase" style={{ color: "var(--mute)", letterSpacing: "0.12em" }}>
            Task · {String(task.task_id).slice(0, 8)}
          </span>
          <button
            onClick={onClose}
            className="dashboard-btn az-mono rounded-full px-3 py-1.5 text-[12px]"
            style={{ border: "1px solid var(--line)" }}
          >
            ✕ close
          </button>
        </div>
        <div className="px-7 pb-10 pt-7">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span
              className="az-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
              style={{
                color: `oklch(0.82 0.09 ${hue})`,
                background: `color-mix(in oklab, oklch(0.82 0.09 ${hue}) 16%, transparent)`,
                border: `1px solid color-mix(in oklab, oklch(0.82 0.09 ${hue}) 30%, transparent)`,
              }}
            >
              {glyph} {formatCategoryLabel(task.category)}
            </span>
          </div>
          <h2 className="font-serif text-[32px] leading-tight" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {task.title}
          </h2>
          <p className="mt-3.5 text-[14.5px] leading-[1.55]" style={{ color: "var(--ink-2)" }}>
            {task.instructions || "No description provided."}
          </p>

          <div
            className="mt-6 grid gap-3.5 rounded-[12px] p-5"
            style={{ gridTemplateColumns: "1fr 1fr", border: "1px solid var(--line)", background: "var(--card)" }}
          >
            <div>
              <div className="az-mono mb-1 text-[10px] uppercase" style={{ color: "var(--mute)", letterSpacing: "0.12em" }}>
                Bounty
              </div>
              <div className="font-serif text-[40px] leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
                ${bounty}
              </div>
              <div className="az-mono mt-1 text-[11px]" style={{ color: "var(--mute)" }}>USDC · gasless release</div>
            </div>
            <div>
              <div className="az-mono mb-1 text-[10px] uppercase" style={{ color: "var(--mute)", letterSpacing: "0.12em" }}>
                Status
              </div>
              <div className="mt-1 text-[18px] font-medium capitalize" style={{ color: "var(--ink)" }}>
                {task.status.replace(/_/g, " ")}
              </div>
            </div>
          </div>

          <div className="mt-7 flex gap-2.5">
            <Link
              href={`/tasks/${task.task_id}`}
              className="dashboard-btn flex-1 rounded-full py-3.5 text-center text-[14px] font-semibold"
              style={{ background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--accent)" }}
            >
              Accept — lock escrow <span className="arrow">→</span>
            </Link>
            <button
              onClick={onClose}
              className="dashboard-btn rounded-full px-5 py-3.5 text-[14px]"
              style={{ border: "1px solid var(--line)" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function TasksMarket({ tasks }: { tasks: TaskRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("bounty");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);

  const categories = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => s.add(t.category));
    return Array.from(s);
  }, [tasks]);

  const filtered = useMemo(() => {
    let arr = tasks.filter((t) => {
      const matchQ =
        !q.trim() ||
        t.title.toLowerCase().includes(q.toLowerCase()) ||
        String(t.task_id).toLowerCase().includes(q.toLowerCase());
      const matchC = cat === "all" || t.category === cat;
      return matchQ && matchC;
    });
    if (sort === "bounty") {
      arr = [...arr].sort((a, b) => Number(b.bounty_micros ?? 0) - Number(a.bounty_micros ?? 0));
    } else if (sort === "status") {
      arr = [...arr].sort((a, b) => statusSortRank(a.status) - statusSortRank(b.status));
    } else if (sort === "newest") {
      arr = [...arr].reverse();
    }
    return arr;
  }, [tasks, q, cat, sort]);

  const pool = totalPool(filtered);

  return (
    <div className="min-w-0">
      <StatStrip tasks={tasks} />

      <FilterBar
        q={q} setQ={setQ} cat={cat} setCat={setCat}
        sort={sort} setSort={setSort} view={view} setView={setView}
        categories={categories}
      />

      {/* Results header */}
      <div
        className="dashboard-reveal dashboard-reveal-d3 mb-4 flex flex-col gap-2 pb-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-0"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="min-w-0">
          <div className="font-serif text-[22px] leading-tight sm:text-[26px]" style={{ color: "var(--ink)" }}>
            {cat === "all" ? "All open tasks" : formatCategoryLabel(cat)}
          </div>
          <div className="az-mono mt-1 text-[10.5px] sm:text-[11px]" style={{ color: "var(--mute)" }}>
            {filtered.length} tasks · pool{" "}
            <span className="digit-pop">${pool.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <span className="az-mono shrink-0 text-[10.5px] sm:text-[11px]" style={{ color: "var(--mute)" }}>
          sorted by {sort}
        </span>
      </div>

      {/* Task grid — equal-height rows via items-stretch + h-full cards */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
          {filtered.map((t, i) => (
            <div
              key={t.task_id}
              className="dashboard-reveal flex h-full min-h-0 min-w-0"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <TaskCard task={t} onOpen={setOpenTask} />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {filtered.map((t, i) => (
              <div key={t.task_id} className="dashboard-reveal" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
                <TaskRowItem task={t} onOpen={setOpenTask} />
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="az-mono py-12 text-center text-[13px]" style={{ color: "var(--mute)" }}>
          No tasks match your filters.
        </p>
      )}

      <Drawer task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}
