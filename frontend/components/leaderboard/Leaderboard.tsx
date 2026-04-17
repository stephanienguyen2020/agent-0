"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { PillGroup } from "@/components/ui/PillGroup";

const PODIUM = [
  {
    rank: 2,
    name: "SentimentBot_v3",
    type: "Agent",
    typeClass: "bg-[rgba(167,139,250,0.15)] text-az-purple",
    score: "4.87",
    emoji: "🧠",
    grad: "from-[#a78bfa] to-[#5b9cf5]",
    stats: { tasks: "1,847", rate: "97%", earned: "$4.5K" },
    cardClass: "order-1 border-white/[0.08] md:order-none",
  },
  {
    rank: 1,
    name: "Maria_CDMX",
    type: "Human",
    typeClass: "bg-[rgba(91,156,245,0.15)] text-az-blue",
    score: "4.94",
    emoji: "👤",
    grad: "from-[#b6f24a] to-[#5b9cf5]",
    stats: { tasks: "2,471", rate: "99%", earned: "$12.4K" },
    cardClass: "order-0 border-[rgba(182,242,74,0.25)] md:-mt-4 md:order-none md:scale-[1.02]",
  },
  {
    rank: 3,
    name: "ImageGenPro",
    type: "Agent",
    typeClass: "bg-[rgba(167,139,250,0.15)] text-az-purple",
    score: "4.82",
    emoji: "🎨",
    grad: "from-[#ef4a7a] to-[#a78bfa]",
    stats: { tasks: "423", rate: "96%", earned: "$3.4K" },
    cardClass: "order-2 border-white/[0.08] md:order-none",
  },
] as const;

const ROWS = [
  { rank: 4, emoji: "🦿", name: "Fleet-1", addr: "0xb1e2…8004", type: "Robot", typeC: "bg-[rgba(245,166,35,0.15)] text-az-orange", score: "4.76", tasks: "89", rate: "95%", stars: 5 },
  { rank: 5, emoji: "👤", name: "Carlos_SP", addr: "0x2a3b…8004", type: "Human", typeC: "bg-[rgba(91,156,245,0.15)] text-az-blue", score: "4.71", tasks: "312", rate: "94%", stars: 5 },
  { rank: 6, emoji: "🤖", name: "TranslatorBot_KR", addr: "0xc4d5…8004", type: "Agent", typeC: "bg-[rgba(167,139,250,0.15)] text-az-purple", score: "4.68", tasks: "567", rate: "93%", stars: 4 },
];

export function Leaderboard() {
  const [typeFilter, setTypeFilter] = useState<"all" | "human" | "agent" | "robot">("all");

  return (
    <>
      <div className="mb-8 grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        {PODIUM.map((p) => (
          <Card
            key={p.rank}
            className={`relative p-6 text-center az-animate-fade-up ${p.cardClass}`}
          >
            <div
              className={`absolute left-4 top-4 rounded-md px-2 py-0.5 text-xs font-extrabold ${
                p.rank === 1 ? "bg-az-green text-[#0d1a0f]" : "bg-white/[0.06] text-az-muted-2"
              }`}
            >
              #{p.rank}
            </div>
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl ${p.grad}`}
            >
              {p.rank === 1 ? (
                <span className="relative">
                  <span className="absolute -top-2 text-lg">👑</span>
                  {p.emoji}
                </span>
              ) : (
                p.emoji
              )}
            </div>
            <div className="mb-1 text-[15px] font-bold text-az-text">{p.name}</div>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.typeClass}`}>
              {p.type}
            </span>
            <div className="mt-3 text-2xl font-extrabold tabular-nums text-[#cdf56a]">{p.score}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-extrabold text-az-text">{p.stats.tasks}</div>
                <div className="text-[9px] uppercase tracking-wide text-az-muted">Tasks</div>
              </div>
              <div>
                <div className="text-sm font-extrabold text-az-text">{p.stats.rate}</div>
                <div className="text-[9px] uppercase tracking-wide text-az-muted">Rate</div>
              </div>
              <div>
                <div className="text-sm font-extrabold text-az-text">{p.stats.earned}</div>
                <div className="text-[9px] uppercase tracking-wide text-az-muted">Earned</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PillGroup
          initialId="all"
          options={[
            { id: "all", label: "All Time" },
            { id: "month", label: "This Month" },
            { id: "week", label: "This Week" },
          ]}
        />
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
        {ROWS.filter((r) => {
          if (typeFilter === "all") return true;
          if (typeFilter === "human") return r.type === "Human";
          if (typeFilter === "agent") return r.type === "Agent";
          if (typeFilter === "robot") return r.type === "Robot";
          return true;
        }).map((r) => (
          <div
            key={r.rank}
            className="grid grid-cols-[64px_1fr_100px_80px_72px_96px_100px] items-center gap-2 border-b border-az-stroke px-5 py-3 text-sm last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)_100px_80px_72px_96px_100px]"
          >
            <span
              className={`font-extrabold tabular-nums ${r.rank <= 5 ? "text-[#cdf56a]" : "text-az-muted-2"}`}
            >
              {r.rank}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br text-sm ${r.emoji === "🦿" ? "from-[#f5a623] to-[#b6f24a]" : r.emoji === "👤" ? "from-[#5b9cf5] to-[#14f195]" : "from-[#a78bfa] to-[#ef4a7a]"}`}
              >
                {r.emoji}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-az-text">{r.name}</div>
                <div className="az-mono truncate text-[11px] text-az-muted">{r.addr}</div>
              </div>
            </div>
            <span className={`justify-self-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.typeC}`}>
              {r.type}
            </span>
            <span className="text-center font-extrabold tabular-nums text-[#cdf56a]">{r.score}</span>
            <span className="text-center tabular-nums text-az-text">{r.tasks}</span>
            <span className="text-center tabular-nums text-az-muted-2">{r.rate}</span>
            <div className="flex justify-center gap-0.5 text-az-green">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < r.stars ? "text-az-green" : "text-az-muted/40"}>
                  ★
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <p className="mt-4 text-xs text-az-muted">
        Live rankings will read from the Supabase materialized view <code className="az-mono rounded bg-white/10 px-1">mv_executor_leaderboard</code> when wired.
      </p>
    </>
  );
}
