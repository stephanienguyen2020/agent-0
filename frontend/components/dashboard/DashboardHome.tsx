"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";

import { fetchDashboardOverview, type DashboardVolumeRange } from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatUsdFromMicros(s: string | undefined): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  const usd = n / 1_000_000;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  return `$${usd.toFixed(usd >= 100 ? 0 : 1)}`;
}

function fmtAvgMinutes(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "—";
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = Date.now() - t;
  const m = Math.floor(d / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function fmtBountyUsdc(micros: string): string {
  const n = Number(micros);
  if (!Number.isFinite(n)) return "—";
  const v = n / 1_000_000;
  const s = v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `+${s}`;
}

function categoryHue(slug: string): number {
  const c = slug.toLowerCase();
  if (c === "physical_presence") return 145;
  if (c === "knowledge_access") return 240;
  if (c === "human_authority") return 55;
  if (c === "simple_action") return 20;
  if (c === "digital_physical") return 265;
  return 200;
}

function settlementAccent(category: string | null | undefined): string {
  const c = (category || "").toLowerCase();
  if (c === "physical_presence") return "var(--accent)";
  if (c === "knowledge_access") return "oklch(0.78 0.18 240)";
  if (c === "human_authority") return "oklch(0.78 0.18 55)";
  if (c === "simple_action") return "oklch(0.78 0.18 20)";
  return "oklch(0.78 0.18 265)";
}

function executorHue(type: string | null | undefined): number {
  const t = (type || "").toLowerCase();
  if (t === "human") return 240;
  if (t === "robot") return 295;
  return 145;
}

function executorTypeColor(type: string | null | undefined): string {
  const t = (type || "").toLowerCase();
  if (t === "human") return "oklch(0.78 0.18 240)";
  if (t === "robot") return "oklch(0.78 0.18 295)";
  return "var(--accent)";
}

function volumeRangeSubtitle(vr: DashboardVolumeRange): string {
  if (vr === "24h") return "24h";
  if (vr === "7d") return "7d";
  if (vr === "30d") return "30d";
  return "90d";
}

const RANGE_TABS: { api: DashboardVolumeRange; label: string }[] = [
  { api: "24h", label: "24H" },
  { api: "7d", label: "7D" },
  { api: "30d", label: "30D" },
  { api: "all", label: "ALL" },
];

function Eyebrow({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="az-mono"
      style={{
        fontSize: 10.5,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--mute)",
        ...style,
      }}
    >
      {children}
    </div>
  );
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

const edCard: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 14,
  background: "var(--card)",
  boxShadow: "var(--shadow-soft)",
};

// ── KPI Cards ────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  glyph,
  hue,
  delay,
  deltaPct,
  deltaKind,
}: {
  label: string;
  value: string;
  glyph: string;
  hue: number;
  delay: string;
  deltaPct: number | null | undefined;
  deltaKind: "higher_good" | "lower_good";
}) {
  const { ref, onMouseMove } = useSpot();
  const iconColor = hue === 145 ? "var(--accent)" : `oklch(0.78 0.16 ${hue})`;
  const iconBg = `color-mix(in oklab, ${iconColor} 22%, transparent)`;
  const showDelta = deltaPct != null && Number.isFinite(deltaPct);
  let up: boolean;
  if (showDelta) {
    const raw = deltaPct as number;
    if (deltaKind === "lower_good") up = raw <= 0;
    else up = raw >= 0;
  } else {
    up = true;
  }
  const deltaStr = showDelta ? `${(deltaPct as number) > 0 ? "+" : ""}${deltaPct}%` : "";

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className="spot dashboard-reveal min-w-0"
      style={{ ...edCard, padding: "18px 20px", animationDelay: delay }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Eyebrow>{label}</Eyebrow>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: iconBg,
            color: iconColor,
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          {glyph}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: 40,
          lineHeight: 1,
          marginTop: 14,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        <span className="digit-pop">{value}</span>
      </div>
      {showDelta ? (
        <div
          className="az-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 12,
            padding: "3px 8px",
            background: up
              ? "color-mix(in oklab, var(--accent) 14%, transparent)"
              : "color-mix(in oklab, var(--danger) 14%, transparent)",
            color: up ? "var(--accent)" : "var(--danger)",
            borderRadius: 999,
            fontSize: 11,
          }}
        >
          <span>{up ? "↑" : "↓"}</span> {deltaStr}
        </div>
      ) : null}
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: { label: string; count: number }[] }) {
  const W = 680,
    H = 190,
    P = { l: 24, r: 16, t: 10, b: 30 };
  const data = points.map((p) => p.count);
  const n = data.length;

  if (n === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <line
          x1={P.l}
          x2={W - P.r}
          y1={H - P.b}
          y2={H - P.b}
          stroke="var(--line-2)"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const denom = max - min + 0.001;
  const innerW = W - P.l - P.r;
  const step = n <= 1 ? 0 : innerW / (n - 1);
  const pts = data.map((v, i) => [
    P.l + i * step,
    P.t + (H - P.t - P.b) * (1 - (v - min) / denom),
  ]);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${pts[n - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const peakIdx = data.indexOf(Math.max(...data));
  const labelEvery = n > 14 ? Math.ceil(n / 8) : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="ed-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={P.l}
          x2={W - P.r}
          y1={P.t + (H - P.t - P.b) * t}
          y2={P.t + (H - P.t - P.b) * t}
          stroke="var(--line-2)"
          strokeDasharray="3 5"
        />
      ))}
      <path d={fillPath} fill="url(#ed-spark-fill)" className="spark-fill" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-line"
      />
      <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r="8" fill="var(--accent)" opacity="0.2" />
      <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r="4" fill="var(--accent)" />
      <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r="2" fill="var(--card)" />
      {points.map((p, i) => {
        if (i % labelEvery !== 0 && i !== n - 1) return null;
        const x = pts[i][0];
        return (
          <text
            key={`${p.label}-${i}`}
            x={Math.min(W - P.r - 8, Math.max(P.l + 8, x))}
            y={H - 10}
            textAnchor="middle"
            fontSize="10"
            fill="var(--mute)"
            fontFamily="var(--font-jetbrains), monospace"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

function SettlementRow({
  title,
  sub,
  amount,
  accent,
}: {
  title: string;
  sub: string;
  amount: string;
  accent: string;
}) {
  return (
    <div className="set-row">
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: `color-mix(in oklab, ${accent} 22%, transparent)`,
          color: accent,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        ✓
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
        <div className="az-mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <div className="az-mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }}>
        {amount} USDC
      </div>
    </div>
  );
}

function AgentRowItem({
  name,
  typeDisplay,
  typeKey,
}: {
  name: string;
  typeDisplay: string;
  typeKey: string | null;
}) {
  const hue = executorHue(typeKey);
  const color = `oklch(0.78 0.2 ${hue})`;
  const typeColor = executorTypeColor(typeKey);
  return (
    <div className="agent-row">
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: `conic-gradient(from ${hue}deg, ${color}, oklch(0.70 0.20 ${(hue + 80) % 360}), ${color})`,
        }}
      />
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{name}</div>
      <span
        className="az-mono"
        style={{
          fontSize: 9.5,
          padding: "3px 8px",
          borderRadius: 999,
          letterSpacing: ".08em",
          border: "1px solid var(--line)",
          color: typeColor,
          background: `color-mix(in oklab, ${typeColor} 12%, transparent)`,
        }}
      >
        {typeDisplay.toUpperCase()}
      </span>
    </div>
  );
}

// ── DashboardHome ─────────────────────────────────────────────────────────────

export function DashboardHome() {
  const [volumeRange, setVolumeRange] = useState<DashboardVolumeRange>("7d");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-overview", volumeRange],
    queryFn: () => fetchDashboardOverview({ volumeRange }),
  });

  const kpis = data?.kpis;
  const taskVolume = data?.task_volume ?? [];
  const categories = data?.category_distribution ?? [];
  const settlements = data?.recent_settlements ?? [];
  const executors = data?.executors_highlight ?? [];

  const errMsg = isError ? (error instanceof Error ? error.message : "Failed to load dashboard") : "";

  return (
    <div className="dashboard-editorial" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {isError ? (
        <div
          className="rounded-[14px] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {errMsg.toLowerCase().includes("503") || errMsg.toLowerCase().includes("supabase")
            ? "Dashboard metrics are unavailable (API or database not configured)."
            : `Could not load dashboard: ${errMsg}`}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KPICard
          label="Tasks completed"
          value={isLoading ? "…" : (kpis?.tasks_completed ?? 0).toLocaleString()}
          deltaPct={kpis?.tasks_completed_delta_pct}
          deltaKind="higher_good"
          glyph="✓"
          hue={145}
          delay="60ms"
        />
        <KPICard
          label="Active agents"
          value={isLoading ? "…" : (kpis?.active_executors ?? 0).toLocaleString()}
          deltaPct={kpis?.active_executors_delta_pct}
          deltaKind="higher_good"
          glyph="▦"
          hue={240}
          delay="140ms"
        />
        <KPICard
          label="Avg completion"
          value={isLoading ? "…" : fmtAvgMinutes(kpis?.avg_completion_minutes)}
          deltaPct={kpis?.avg_completion_delta_pct}
          deltaKind="lower_good"
          glyph="◷"
          hue={295}
          delay="220ms"
        />
        <KPICard
          label="USDC volume · 24h"
          value={isLoading ? "…" : formatUsdFromMicros(kpis?.usdc_volume_24h_micros)}
          deltaPct={kpis?.usdc_volume_24h_delta_pct}
          deltaKind="higher_good"
          glyph="✦"
          hue={75}
          delay="300ms"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div
          className="dashboard-reveal"
          style={{ ...edCard, padding: "20px 22px", animationDelay: "300ms" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Eyebrow>Task volume</Eyebrow>
              <div
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: 24,
                  marginTop: 4,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                }}
              >
                Task volume{" "}
                <span style={{ color: "var(--mute)", fontStyle: "italic", fontSize: 16 }}>
                  · last {volumeRangeSubtitle(volumeRange)}
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 2,
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: 3,
                background: "var(--bg-2)",
                flexShrink: 0,
              }}
            >
              {RANGE_TABS.map(({ api, label }) => (
                <button
                  key={api}
                  type="button"
                  onClick={() => setVolumeRange(api)}
                  className="dashboard-btn"
                  style={{
                    border: "none",
                    background: volumeRange === api ? "var(--card)" : "transparent",
                    color: volumeRange === api ? "var(--ink)" : "var(--mute)",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 11.5,
                    fontWeight: 500,
                    boxShadow:
                      volumeRange === api
                        ? "0 1px 2px color-mix(in oklab, var(--ink) 12%, transparent)"
                        : "none",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div style={{ height: 190, borderRadius: 8, background: "var(--bg-2)" }} className="animate-pulse" />
          ) : (
            <Sparkline points={taskVolume} />
          )}
        </div>

        <div
          className="dashboard-reveal"
          style={{ ...edCard, padding: "20px 22px", animationDelay: "360ms" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: 22,
                color: "var(--ink)",
              }}
            >
              By category
            </div>
            <span className="az-mono" style={{ fontSize: 10.5, color: "var(--mute)", letterSpacing: ".1em" }}>
              mix
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-white/[0.06]" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-[color:var(--mute)]">No task categories in the sample yet.</p>
            ) : (
              categories.map((c) => {
                const hue = categoryHue(c.category);
                return (
                  <div key={c.category}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        marginBottom: 6,
                        gap: 8,
                      }}
                    >
                      <span
                        className="az-mono"
                        style={{
                          color: `oklch(0.78 0.18 ${hue})`,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.label}
                      </span>
                      <span className="az-mono" style={{ color: "var(--mute)", flexShrink: 0 }}>
                        {c.pct}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
                      <div
                        className="cat-bar"
                        style={
                          {
                            "--w": c.pct / 100,
                            height: "100%",
                            width: "100%",
                            background: `oklch(0.78 0.18 ${hue})`,
                            borderRadius: 999,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div
          className="dashboard-reveal"
          style={{ ...edCard, padding: "20px 22px", animationDelay: "380ms" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: 22, color: "var(--ink)" }}>
              Recent settlements
            </div>
            <Link href="/wallet" className="az-mono" style={{ fontSize: 11, color: "var(--mute)" }}>
              See all →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
          ) : settlements.length === 0 ? (
            <p className="text-sm text-[color:var(--mute)]">No completed tasks yet.</p>
          ) : (
            settlements.map((s) => (
              <SettlementRow
                key={s.task_id}
                title={s.title || s.task_id}
                sub={`${(s.category || "").replace(/_/g, " ") || "task"} · ${relTime(s.settled_at)}`}
                amount={fmtBountyUsdc(s.bounty_micros)}
                accent={settlementAccent(s.category)}
              />
            ))
          )}
        </div>

        <div
          className="dashboard-reveal"
          style={{ ...edCard, padding: "20px 22px", animationDelay: "440ms" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: 22, color: "var(--ink)" }}>
              Top executors
            </div>
            <Link href="/agents" className="az-mono" style={{ fontSize: 11, color: "var(--mute)" }}>
              See all →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
          ) : executors.length === 0 ? (
            <p className="text-sm text-[color:var(--mute)]">No active executors yet.</p>
          ) : (
            executors.map((e) => (
              <AgentRowItem
                key={e.wallet || e.display_name}
                name={e.display_name}
                typeDisplay={e.type_display}
                typeKey={e.type}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
