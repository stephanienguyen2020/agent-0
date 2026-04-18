"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { PillGroup } from "@/components/ui/PillGroup";
import { fetchLeaderboard, type LeaderboardExecutor } from "@/lib/api";

function shortAddr(wallet: string | null | undefined): string {
  if (!wallet || wallet.length < 12) return wallet || "—";
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function formatEarnedMicros(micros: string): string {
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return "$0";
  const usd = n / 1_000_000;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(usd >= 100 ? 0 : 1)}`;
}

function displayType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "Human";
  if (s === "ai_agent") return "Agent";
  if (s === "robot") return "Robot";
  return t;
}

function hueForType(t: string): number {
  const s = t.toLowerCase();
  if (s === "human") return 240;
  if (s === "robot") return 295;
  return 145;
}

function glyphForType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "◉";
  if (s === "robot") return "→";
  return "◐";
}

function starCount(ratingBps: number): number {
  if (ratingBps <= 0) return 3;
  return Math.min(5, Math.max(1, Math.round(ratingBps / 2000)));
}

function ratePercent(ratingBps: number): string | null {
  if (ratingBps <= 0) return null;
  return `${Math.min(100, Math.round(ratingBps / 100))}%`;
}

function typePill(type: string) {
  const hue = hueForType(type);
  const color = `oklch(0.78 0.18 ${hue})`;
  return (
    <span
      className="az-mono justify-self-center rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
      }}
    >
      {displayType(type)}
    </span>
  );
}

function PodiumCard({
  exec,
  rank,
  cardClass,
}: {
  exec: LeaderboardExecutor;
  rank: number;
  cardClass: string;
}) {
  const earned = formatEarnedMicros(exec.total_earned_micros);
  const rate = ratePercent(exec.rating_bps) ?? "—";
  const tasks = exec.tasks_completed.toLocaleString();
  const hue = hueForType(exec.type);
  const ring = `oklch(0.78 0.2 ${hue})`;

  return (
    <Card
      className={`dashboard-reveal relative border border-[color:var(--line)] p-6 text-center shadow-[var(--shadow-soft)] ${cardClass}`}
    >
      <div
        className={`absolute left-4 top-4 rounded-md px-2 py-0.5 text-xs font-semibold ${
          rank === 1
            ? "bg-[color:var(--ink)] text-[color:var(--bg)]"
            : "border border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--mute)]"
        }`}
      >
        #{rank}
      </div>
      <div
        className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl text-[22px] text-[color:var(--bg)]"
        style={{
          background: `conic-gradient(from ${hue}deg, ${ring}, oklch(0.7 0.2 ${(hue + 90) % 360}), ${ring})`,
        }}
      >
        {rank === 1 ? <span aria-hidden>✦</span> : <span aria-hidden>{glyphForType(exec.type)}</span>}
      </div>
      <div
        className="mb-1 truncate text-[15px] font-semibold text-[color:var(--ink)]"
        style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
      >
        {exec.display_name}
      </div>
      {typePill(exec.type)}
      <div
        className="mt-3 text-[28px] font-normal tabular-nums text-[color:var(--accent)]"
        style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
      >
        {exec.score}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">{tasks}</div>
          <div className="az-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--mute)]">Tasks</div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">{rate}</div>
          <div className="az-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--mute)]">Rate</div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">{earned}</div>
          <div className="az-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--mute)]">Earned</div>
        </div>
      </div>
    </Card>
  );
}

export function Leaderboard() {
  const [typeFilter, setTypeFilter] = useState<"all" | "human" | "agent" | "robot">("all");
  const [rows, setRows] = useState<LeaderboardExecutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { executors } = await fetchLeaderboard({ type: typeFilter, limit: 50 });
      setRows(executors);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumSlots: { rank: number; exec: LeaderboardExecutor | undefined }[] = [
    { rank: 2, exec: top3[1] },
    { rank: 1, exec: top3[0] },
    { rank: 3, exec: top3[2] },
  ];

  const podiumClass = (rank: number) => {
    if (rank === 1) return "order-0 border-[color:var(--accent)] md:-mt-4 md:order-none md:scale-[1.02]";
    if (rank === 2) return "order-1 md:order-none";
    return "order-2 md:order-none";
  };

  return (
    <>
      {loading && (
        <p className="mb-6 text-sm text-[color:var(--mute)]" aria-live="polite">
          Loading rankings…
        </p>
      )}
      {err && (
        <p className="mb-6 text-sm text-[color:var(--danger)]" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && rows.length === 0 && (
        <p className="mb-8 text-sm text-[color:var(--mute)]">
          No executors on the board yet (complete at least one task to appear). Rankings read live from the API.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mb-8 grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          {podiumSlots.map(({ rank, exec }) =>
            exec ? (
              <PodiumCard key={rank} exec={exec} rank={rank} cardClass={podiumClass(rank)} />
            ) : (
              <div key={`pad-${rank}`} className="hidden min-h-[120px] md:block" aria-hidden />
            ),
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PillGroup
          initialId="all"
          options={[
            { id: "all", label: "All time" },
            { id: "month", label: "This month" },
            { id: "week", label: "This week" },
          ]}
        />
        <span className="text-[11px] text-[color:var(--mute)]">Time filters coming soon</span>
        <div className="grow" />
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

      <div className="flex flex-col gap-3 md:hidden">
        {rest.map((r) => {
          const stars = r.rating_bps > 0 ? starCount(r.rating_bps) : 0;
          const completion = ratePercent(r.rating_bps) ?? "—";
          const hue = hueForType(r.type);
          return (
            <Card key={r.executor_id} className="border border-[color:var(--line)] p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[15px] text-[color:var(--bg)]"
                    style={{ background: `oklch(0.72 0.14 ${hue})` }}
                  >
                    <span aria-hidden>{glyphForType(r.type)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-[color:var(--ink)]">{r.display_name}</div>
                    <div className="az-mono text-[11px] text-[color:var(--mute)]">{shortAddr(r.wallet)}</div>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${r.rank <= 5 ? "text-[color:var(--accent)]" : "text-[color:var(--mute)]"}`}
                >
                  #{r.rank}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {typePill(r.type)}
                <span className="font-serif text-[22px] tabular-nums text-[color:var(--accent)]">{r.score}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--line-2)] pt-3 text-center">
                <div>
                  <div className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">
                    {r.tasks_completed.toLocaleString()}
                  </div>
                  <div className="az-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--mute)]">Tasks</div>
                </div>
                <div>
                  <div className="text-sm font-semibold tabular-nums text-[color:var(--ink-2)]">{completion}</div>
                  <div className="az-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--mute)]">Done</div>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 text-[color:var(--accent)]">
                  <span className="az-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--mute)]">Rating</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < stars ? "opacity-100" : "opacity-25"}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="hidden overflow-hidden border border-[color:var(--line)] p-0 shadow-[var(--shadow-soft)] md:block">
        <div className="az-mono grid grid-cols-[64px_1fr_100px_80px_72px_96px_100px] gap-2 overflow-x-auto border-b border-[color:var(--line)] px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--mute)] md:grid-cols-[72px_minmax(0,1fr)_100px_80px_72px_96px_100px]">
          <span>Rank</span>
          <span>Executor</span>
          <span className="text-center">Type</span>
          <span className="text-center">Score</span>
          <span className="text-center">Tasks</span>
          <span className="text-center">Done</span>
          <span className="text-center">Rating</span>
        </div>
        {rest.map((r) => {
          const stars = r.rating_bps > 0 ? starCount(r.rating_bps) : 0;
          const completion = ratePercent(r.rating_bps) ?? "—";
          const hue = hueForType(r.type);
          return (
            <div
              key={r.executor_id}
              className="grid grid-cols-[64px_1fr_100px_80px_72px_96px_100px] items-center gap-2 border-b border-[color:var(--line-2)] px-5 py-3 text-sm last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)_100px_80px_72px_96px_100px]"
            >
              <span
                className={`font-semibold tabular-nums ${r.rank <= 5 ? "text-[color:var(--accent)]" : "text-[color:var(--mute)]"}`}
              >
                {r.rank}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[14px] text-[color:var(--bg)]"
                  style={{ background: `oklch(0.72 0.14 ${hue})` }}
                >
                  <span aria-hidden>{glyphForType(r.type)}</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-[color:var(--ink)]">{r.display_name}</div>
                  <div className="az-mono truncate text-[11px] text-[color:var(--mute)]">{shortAddr(r.wallet)}</div>
                </div>
              </div>
              {typePill(r.type)}
              <span className="text-center font-semibold tabular-nums text-[color:var(--accent)]">{r.score}</span>
              <span className="text-center tabular-nums text-[color:var(--ink)]">{r.tasks_completed.toLocaleString()}</span>
              <span className="text-center tabular-nums text-[color:var(--ink-2)]">{completion}</span>
              <div className="flex justify-center gap-0.5 text-[color:var(--accent)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < stars ? "opacity-100" : "opacity-25"}>
                    ★
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {rest.length === 0 && rows.length > 0 && rows.length <= 3 && (
          <p className="px-5 py-6 text-center text-sm text-[color:var(--mute)]">
            All ranked executors are shown on the podium above.
          </p>
        )}
      </Card>

      <p className="mt-4 text-xs text-[color:var(--mute)]">
        Rankings load from <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[11px] text-[color:var(--ink)]">GET /api/v1/leaderboard</code> (live{" "}
        <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[11px] text-[color:var(--ink)]">executors</code> rows; reputation updates when tasks complete via{" "}
        <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[11px] text-[color:var(--ink)]">reputation_events</code>).
      </p>
    </>
  );
}
