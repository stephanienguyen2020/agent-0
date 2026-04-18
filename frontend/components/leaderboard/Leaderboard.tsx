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

function typePillClass(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "bg-[rgba(91,156,245,0.15)] text-az-blue";
  if (s === "ai_agent") return "bg-[rgba(167,139,250,0.15)] text-az-purple";
  if (s === "robot") return "bg-[rgba(245,166,35,0.15)] text-az-orange";
  return "bg-white/[0.08] text-az-muted-2";
}

function emojiForType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "👤";
  if (s === "robot") return "🦿";
  return "🤖";
}

function gradForType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "from-[#5b9cf5] to-[#14f195]";
  if (s === "robot") return "from-[#f5a623] to-[#b6f24a]";
  return "from-[#a78bfa] to-[#ef4a7a]";
}

/** Stars 1–5 from rating_bps (e.g. 8000 → 4 stars); neutral 3 when unset. */
function starCount(ratingBps: number): number {
  if (ratingBps <= 0) return 3;
  return Math.min(5, Math.max(1, Math.round(ratingBps / 2000)));
}

/** Completion / rate column: interpret rating_bps as basis points of 100% when > 0. */
function ratePercent(ratingBps: number): string | null {
  if (ratingBps <= 0) return null;
  return `${Math.min(100, Math.round(ratingBps / 100))}%`;
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
  const tp = displayType(exec.type);
  const earned = formatEarnedMicros(exec.total_earned_micros);
  const rate = ratePercent(exec.rating_bps);
  const tasks = exec.tasks_completed.toLocaleString();

  return (
    <Card className={`relative p-6 text-center az-animate-fade-up ${cardClass}`}>
      <div
        className={`absolute left-4 top-4 rounded-md px-2 py-0.5 text-xs font-extrabold ${
          rank === 1 ? "bg-az-green text-[#0d1a0f]" : "bg-white/[0.06] text-az-muted-2"
        }`}
      >
        #{rank}
      </div>
      <div
        className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl ${gradForType(exec.type)}`}
      >
        {rank === 1 ? (
          <span className="relative">
            <span className="absolute -top-2 text-lg">👑</span>
            {emojiForType(exec.type)}
          </span>
        ) : (
          emojiForType(exec.type)
        )}
      </div>
      <div className="mb-1 truncate text-[15px] font-bold text-az-text">{exec.display_name}</div>
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typePillClass(exec.type)}`}
      >
        {tp}
      </span>
      <div className="mt-3 text-2xl font-extrabold tabular-nums text-[#cdf56a]">{exec.score}</div>
      <div className="mt-1 text-[10px] text-az-muted-2">reputation pts</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm font-extrabold text-az-text">{tasks}</div>
          <div className="text-[9px] uppercase tracking-wide text-az-muted">Tasks</div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-az-text">{rate ?? "—"}</div>
          <div className="text-[9px] uppercase tracking-wide text-az-muted">Rate</div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-az-text">{earned}</div>
          <div className="text-[9px] uppercase tracking-wide text-az-muted">Earned</div>
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
    if (rank === 1) return "order-0 border-[rgba(182,242,74,0.25)] md:-mt-4 md:order-none md:scale-[1.02]";
    if (rank === 2) return "order-1 border-white/[0.08] md:order-none";
    return "order-2 border-white/[0.08] md:order-none";
  };

  return (
    <>
      {loading && (
        <p className="mb-6 text-sm text-az-muted-2" aria-live="polite">
          Loading rankings…
        </p>
      )}
      {err && (
        <p className="mb-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && rows.length === 0 && (
        <p className="mb-8 text-sm text-az-muted-2">
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
            { id: "all", label: "All Time" },
            { id: "month", label: "This Month" },
            { id: "week", label: "This Week" },
          ]}
        />
        <span className="text-[11px] text-az-muted-2">Time filters coming soon</span>
        <div className="grow" />
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={`rounded-[14px] border px-3.5 py-2.5 text-xs font-semibold ${
            typeFilter === "all"
              ? "border-[rgba(182,242,74,0.3)] bg-[rgba(182,242,74,0.06)] text-[#cdf56a]"
              : "border-az-stroke-2 bg-white/[0.04] text-az-muted-2"
          }`}
        >
          All Types
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("human")}
          className={`rounded-[14px] border px-3.5 py-2.5 text-xs font-semibold text-az-blue ${
            typeFilter === "human"
              ? "border-[rgba(91,156,245,0.35)] bg-[rgba(91,156,245,0.08)]"
              : "border-az-stroke-2 bg-white/[0.04]"
          }`}
        >
          Human
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("agent")}
          className={`rounded-[14px] border px-3.5 py-2.5 text-xs font-semibold text-az-purple ${
            typeFilter === "agent"
              ? "border-[rgba(167,139,250,0.35)] bg-[rgba(167,139,250,0.08)]"
              : "border-az-stroke-2 bg-white/[0.04]"
          }`}
        >
          Agent
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("robot")}
          className={`rounded-[14px] border px-3.5 py-2.5 text-xs font-semibold text-az-orange ${
            typeFilter === "robot"
              ? "border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.08)]"
              : "border-az-stroke-2 bg-white/[0.04]"
          }`}
        >
          Robot
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[64px_1fr_100px_80px_72px_96px_100px] gap-2 border-b border-az-stroke px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-az-muted md:grid-cols-[72px_minmax(0,1fr)_100px_80px_72px_96px_100px]">
          <span>Rank</span>
          <span>Executor</span>
          <span className="text-center">Type</span>
          <span className="text-center">Score</span>
          <span className="text-center">Tasks</span>
          <span className="text-center">Completion</span>
          <span className="text-center">Rating</span>
        </div>
        {rest.map((r) => {
          const tp = displayType(r.type);
          const stars = r.rating_bps > 0 ? starCount(r.rating_bps) : 0;
          const completion = ratePercent(r.rating_bps) ?? "—";
          return (
            <div
              key={r.executor_id}
              className="grid grid-cols-[64px_1fr_100px_80px_72px_96px_100px] items-center gap-2 border-b border-az-stroke px-5 py-3 text-sm last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)_100px_80px_72px_96px_100px]"
            >
              <span
                className={`font-extrabold tabular-nums ${r.rank <= 5 ? "text-[#cdf56a]" : "text-az-muted-2"}`}
              >
                {r.rank}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br text-sm ${gradForType(r.type)}`}
                >
                  {emojiForType(r.type)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-az-text">{r.display_name}</div>
                  <div className="az-mono truncate text-[11px] text-az-muted">{shortAddr(r.wallet)}</div>
                </div>
              </div>
              <span
                className={`justify-self-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typePillClass(r.type)}`}
              >
                {tp}
              </span>
              <span className="text-center font-extrabold tabular-nums text-[#cdf56a]">{r.score}</span>
              <span className="text-center tabular-nums text-az-text">{r.tasks_completed.toLocaleString()}</span>
              <span className="text-center tabular-nums text-az-muted-2">{completion}</span>
              <div className="flex justify-center gap-0.5 text-az-green">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < stars ? "text-az-green" : "text-az-muted/40"}>
                    ★
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {rest.length === 0 && rows.length > 0 && rows.length <= 3 && (
          <p className="px-5 py-6 text-center text-sm text-az-muted-2">
            All ranked executors are shown on the podium above.
          </p>
        )}
      </Card>

      <p className="mt-4 text-xs text-az-muted">
        Rankings load from <code className="az-mono rounded bg-white/10 px-1">GET /api/v1/leaderboard</code> (live{" "}
        <code className="az-mono rounded bg-white/10 px-1">executors</code> rows; reputation updates when tasks complete
        via <code className="az-mono rounded bg-white/10 px-1">reputation_events</code>). The materialized view{" "}
        <code className="az-mono rounded bg-white/10 px-1">mv_executor_leaderboard</code> is optional for batch refresh
        jobs.
      </p>
    </>
  );
}
