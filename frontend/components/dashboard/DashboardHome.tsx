"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────

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

const KPIS = [
  { label: "Tasks completed",   value: "1,247",  delta: "+12.4%", up: true,  glyph: "✓", hue: 145, delay: "60ms"  },
  { label: "Active agents",     value: "384",    delta: "+8.2%",  up: true,  glyph: "▦", hue: 240, delay: "140ms" },
  { label: "Avg completion",    value: "4.2m",   delta: "−2.1%",  up: false, glyph: "◷", hue: 295, delay: "220ms" },
  { label: "USDC volume · 24h", value: "$48.3K", delta: "+23.7%", up: true,  glyph: "✦", hue: 75,  delay: "300ms" },
];

function KPICard({ label, value, delta, up, glyph, hue, delay }: (typeof KPIS)[0]) {
  const { ref, onMouseMove } = useSpot();
  const iconColor = hue === 145 ? "var(--accent)" : `oklch(0.78 0.16 ${hue})`;
  const iconBg = `color-mix(in oklab, ${iconColor} 22%, transparent)`;
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
        <span>{up ? "↑" : "↓"}</span> {delta}
      </div>
    </div>
  );
}

function KPICards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      {KPIS.map((k) => (
        <KPICard key={k.label} {...k} />
      ))}
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const W = 680,
    H = 190,
    P = { l: 24, r: 16, t: 10, b: 30 };
  const max = Math.max(...data),
    min = Math.min(...data);
  const step = (W - P.l - P.r) / (data.length - 1);
  const pts = data.map((v, i) => [
    P.l + i * step,
    P.t + (H - P.t - P.b) * (1 - (v - min) / (max - min + 0.001)),
  ]);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const peakIdx = data.indexOf(Math.max(...data));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      {days.map((d, i) => (
        <text
          key={d}
          x={pts[i][0]}
          y={H - 10}
          textAnchor="middle"
          fontSize="10"
          fill="var(--mute)"
          fontFamily="var(--font-jetbrains), monospace"
        >
          {d}
        </text>
      ))}
    </svg>
  );
}

// ── ChartRow ──────────────────────────────────────────────────────────────────

const VOLUME_7D = [32, 54, 42, 70, 58, 92, 80];

const CATEGORIES = [
  { label: "Physical presence", pct: 36, hue: 145 },
  { label: "Knowledge access",  pct: 24, hue: 240 },
  { label: "Agent-to-agent",    pct: 18, hue: 295 },
  { label: "Human authority",   pct: 12, hue: 55  },
  { label: "Simple action",     pct: 10, hue: 20  },
];

function ChartRow() {
  const [range, setRange] = useState("7D");
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
      {/* Volume chart */}
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
                · last {range.toLowerCase()}
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
            {["24H", "7D", "30D", "ALL"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="dashboard-btn"
                style={{
                  border: "none",
                  background: range === r ? "var(--card)" : "transparent",
                  color: range === r ? "var(--ink)" : "var(--mute)",
                  borderRadius: 999,
                  padding: "5px 12px",
                  fontSize: 11.5,
                  fontWeight: 500,
                  boxShadow:
                    range === r
                      ? "0 1px 2px color-mix(in oklab, var(--ink) 12%, transparent)"
                      : "none",
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Sparkline data={VOLUME_7D} />
      </div>

      {/* By category */}
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
            7D
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {CATEGORIES.map((c) => (
            <div key={c.label}>
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
                    color: `oklch(0.78 0.18 ${c.hue})`,
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
                      background: `oklch(0.78 0.18 ${c.hue})`,
                      borderRadius: 999,
                    } as React.CSSProperties
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settlements ───────────────────────────────────────────────────────────────

const SETTLEMENTS = [
  { kind: "paid",    title: "Storefront verification — São Paulo", sub: "Settled via x402 · 2 min ago",  amount: "+5.00",  sign: "pos" },
  { kind: "paid",    title: "Sentiment analysis — BTC/USD pair",   sub: "A2A settlement · 6 min ago",    amount: "+2.50",  sign: "pos" },
  { kind: "paid",    title: "Korean whitepaper translation",       sub: "Knowledge task · 15 min ago",   amount: "+12.00", sign: "pos" },
  { kind: "action",  title: "Package pickup — Fleet-1 robot",      sub: "Robot executor · 22 min ago",   amount: "+3.00",  sign: "pos" },
  { kind: "dispute", title: "Disputed: Document notarization",     sub: "Escalated to L3 · 1 hr ago",    amount: "−8.00",  sign: "neg" },
];

function SettlementRow({ s }: { s: (typeof SETTLEMENTS)[0] }) {
  const color =
    s.kind === "paid" ? "var(--accent)" : s.kind === "action" ? "var(--accent-2)" : "var(--danger)";
  const glyph = s.kind === "paid" ? "✓" : s.kind === "action" ? "→" : "!";
  return (
    <div className="set-row">
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: `color-mix(in oklab, ${color} 22%, transparent)`,
          color,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {glyph}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{s.title}</div>
        <div className="az-mono" style={{ fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
          {s.sub}
        </div>
      </div>
      <div
        className="az-mono"
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: s.sign === "pos" ? "var(--accent)" : "var(--danger)",
        }}
      >
        {s.amount} USDC
      </div>
    </div>
  );
}

// ── Agents ────────────────────────────────────────────────────────────────────

const AGENTS = [
  { name: "TaskIntakeAgent", type: "AGENT", hue: 145 },
  { name: "SettlementAgent", type: "AGENT", hue: 145 },
  { name: "VerifierAgent",   type: "AGENT", hue: 145 },
  { name: "Maria_CDMX",      type: "HUMAN", hue: 240 },
  { name: "Fleet-1",         type: "ROBOT", hue: 295 },
  { name: "SentimentBot_v3", type: "AGENT", hue: 145 },
];

function AgentRowItem({ a }: { a: (typeof AGENTS)[0] }) {
  const color = `oklch(0.78 0.2 ${a.hue})`;
  const typeColor =
    a.type === "AGENT"
      ? "var(--accent)"
      : a.type === "HUMAN"
      ? "oklch(0.78 0.18 240)"
      : "oklch(0.78 0.18 295)";
  return (
    <div className="agent-row">
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: `conic-gradient(from ${a.hue}deg, ${color}, oklch(0.70 0.20 ${(a.hue + 80) % 360}), ${color})`,
        }}
      />
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{a.name}</div>
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
        {a.type}
      </span>
      <span
        className="live-dot shrink-0"
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: "var(--accent)",
          display: "block",
        }}
      />
    </div>
  );
}

// ── BottomRow ─────────────────────────────────────────────────────────────────

function BottomRow() {
  return (
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
        {SETTLEMENTS.map((s, i) => (
          <SettlementRow key={i} s={s} />
        ))}
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
            Agents online
          </div>
          <Link href="/agents" className="az-mono" style={{ fontSize: 11, color: "var(--mute)" }}>
            See all →
          </Link>
        </div>
        {AGENTS.map((a) => (
          <AgentRowItem key={a.name} a={a} />
        ))}
      </div>
    </div>
  );
}

// ── DashboardHome ─────────────────────────────────────────────────────────────

export function DashboardHome() {
  return (
    <div className="dashboard-editorial" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <KPICards />
      <ChartRow />
      <BottomRow />
    </div>
  );
}
