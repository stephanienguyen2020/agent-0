import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { PillGroup } from "@/components/ui/PillGroup";

function StatCard({
  icon,
  label,
  value,
  change,
  changeUp,
  iconBg,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  changeUp: boolean;
  iconBg: string;
  delay: string;
}) {
  return (
    <div
      className="az-card az-animate-fade-up relative overflow-hidden p-5"
      style={{ animationDelay: delay }}
    >
      <div
        className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="mb-2.5 text-xs font-medium text-az-muted-2">{label}</div>
      <div className="text-[28px] font-extrabold tracking-tight text-az-text [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      <span
        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          changeUp ? "bg-[rgba(182,242,74,0.15)] text-[#cdf56a]" : "bg-[rgba(239,74,122,0.15)] text-az-red"
        }`}
      >
        {changeUp ? <ArrowUp /> : <ArrowDown />}
        {change}
      </span>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function TaskVolumeChart() {
  return (
    <svg viewBox="0 0 680 200" className="h-[200px] w-full" aria-hidden>
      <defs>
        <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#b6f24a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#b6f24a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5">
        <line x1="0" x2="680" y1="40" y2="40" />
        <line x1="0" x2="680" y1="80" y2="80" />
        <line x1="0" x2="680" y1="120" y2="120" />
        <line x1="0" x2="680" y1="160" y2="160" />
      </g>
      <path
        d="M0,140 C40,130 60,100 97,90 C134,80 160,120 194,110 C228,100 260,60 291,50 C322,40 350,70 388,80 C426,90 455,50 485,30 C515,10 540,40 582,55 C624,70 650,60 680,45 L680,200 L0,200 Z"
        fill="url(#areaG)"
      />
      <path
        d="M0,140 C40,130 60,100 97,90 C134,80 160,120 194,110 C228,100 260,60 291,50 C322,40 350,70 388,80 C426,90 455,50 485,30 C515,10 540,40 582,55 C624,70 650,60 680,45"
        fill="none"
        stroke="#c9f56a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="485" cy="30" r="4" fill="#c9f56a" />
      <circle cx="485" cy="30" r="8" fill="#c9f56a" fillOpacity="0.25" />
      <g fill="var(--muted)" fontSize="10" fontFamily="var(--font-manrope), sans-serif">
        <text x="30" y="195">
          Mon
        </text>
        <text x="127" y="195">
          Tue
        </text>
        <text x="224" y="195">
          Wed
        </text>
        <text x="321" y="195">
          Thu
        </text>
        <text x="418" y="195">
          Fri
        </text>
        <text x="515" y="195">
          Sat
        </text>
        <text x="620" y="195">
          Sun
        </text>
      </g>
    </svg>
  );
}

const CAT_ROWS = [
  { label: "Physical Presence", color: "var(--green-soft)", pct: "36%", w: "72%", bar: "var(--green)" },
  { label: "Knowledge Access", color: "var(--blue)", pct: "24%", w: "48%", bar: "var(--blue)" },
  { label: "Agent-to-Agent", color: "var(--purple)", pct: "18%", w: "36%", bar: "var(--purple)" },
  { label: "Human Authority", color: "var(--orange)", pct: "12%", w: "24%", bar: "var(--orange)" },
  { label: "Simple Action", color: "var(--red)", pct: "10%", w: "20%", bar: "var(--red)" },
];

export function DashboardHome() {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          delay="0.05s"
          label="Tasks Completed"
          value="1,247"
          change="12.4%"
          changeUp
          iconBg="bg-[var(--green-dim)]"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M9 11l3 3L22 4" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                stroke="var(--green)"
                strokeWidth="1.8"
              />
            </svg>
          }
        />
        <StatCard
          delay="0.1s"
          label="Active Agents"
          value="384"
          change="8.2%"
          changeUp
          iconBg="bg-[rgba(91,156,245,0.12)]"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--blue)" strokeWidth="1.8" />
              <circle cx="9" cy="7" r="4" stroke="var(--blue)" strokeWidth="1.8" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--blue)" strokeWidth="1.8" />
            </svg>
          }
        />
        <StatCard
          delay="0.15s"
          label="Avg Completion"
          value="4.2m"
          change="2.1%"
          changeUp={false}
          iconBg="bg-[rgba(167,139,250,0.12)]"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.8" />
              <path d="M12 6v6l4 2" stroke="var(--purple)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard
          delay="0.2s"
          label="USDC Volume (24h)"
          value="$48.3K"
          change="23.7%"
          changeUp
          iconBg="bg-[rgba(245,166,35,0.12)]"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"
                stroke="var(--orange)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 az-animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-az-text">Task Volume</h3>
            <PillGroup
              initialId="7d"
              options={[
                { id: "24h", label: "24H" },
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "all", label: "ALL" },
              ]}
            />
          </div>
          <TaskVolumeChart />
        </Card>

        <Card className="p-5 az-animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-az-text">By Category</h3>
          </div>
          <div className="pt-1">
            {CAT_ROWS.map((row) => (
              <div key={row.label} className="flex items-center gap-3 py-2.5">
                <span className="min-w-[120px] text-xs font-semibold" style={{ color: row.color }}>
                  {row.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: row.w, background: row.bar }}
                  />
                </div>
                <span className="min-w-[36px] text-right text-xs text-az-muted-2 [font-variant-numeric:tabular-nums]">
                  {row.pct}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 az-animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-az-text">Recent Settlements</h3>
            <Link href="/wallet" className="text-xs font-semibold text-[#cdf56a] hover:underline">
              See all →
            </Link>
          </div>
          <ActivityRow
            dotClass="bg-[var(--green-dim)]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="var(--green)" strokeWidth="2" />
                <path d="M22 4L12 14.01l-3-3" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            title="Storefront verification — São Paulo"
            sub="Settled via x402 · 2 min ago"
            amount="+5.00 USDC"
            positive
          />
          <ActivityRow
            dotClass="bg-[rgba(167,139,250,0.12)]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="var(--purple)" strokeWidth="2" />
                <path d="M22 4L12 14.01l-3-3" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            title="Sentiment analysis — BTC/USD pair"
            sub="A2A settlement · 8 min ago"
            amount="+2.50 USDC"
            positive
          />
          <ActivityRow
            dotClass="bg-[rgba(91,156,245,0.12)]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="var(--blue)" strokeWidth="2" />
                <path d="M22 4L12 14.01l-3-3" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            title="Korean whitepaper translation"
            sub="Knowledge task · 15 min ago"
            amount="+12.00 USDC"
            positive
          />
          <ActivityRow
            dotClass="bg-[rgba(245,166,35,0.12)]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="var(--orange)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="Package pickup — Fleet-1 robot"
            sub="Robot executor · 22 min ago"
            amount="+3.00 USDC"
            positive
          />
          <ActivityRow
            dotClass="bg-[rgba(239,74,122,0.12)]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
                  stroke="var(--red)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="Disputed: Document notarization"
            sub="Escalated to L3 · 1 hr ago"
            amount="-8.00 USDC"
            positive={false}
          />
        </Card>

        <Card className="p-5 az-animate-fade-up" style={{ animationDelay: "0.4s" }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-az-text">Agents Online</h3>
            <Link href="/agents" className="text-xs font-semibold text-[#cdf56a] hover:underline">
              See all →
            </Link>
          </div>
          <AgentRow emoji="🤖" name="TaskIntakeAgent" type="Agent" typeClass="bg-[rgba(167,139,250,0.15)] text-az-purple" />
          <AgentRow emoji="⚡" name="SettlementAgent" type="Agent" typeClass="bg-[rgba(167,139,250,0.15)] text-az-purple" />
          <AgentRow emoji="🔍" name="VerifierAgent" type="Agent" typeClass="bg-[rgba(167,139,250,0.15)] text-az-purple" />
          <AgentRow emoji="👤" name="Maria_CDMX" type="Human" typeClass="bg-[rgba(91,156,245,0.15)] text-az-blue" />
          <AgentRow emoji="🦿" name="Fleet-1" type="Robot" typeClass="bg-[rgba(245,166,35,0.15)] text-az-orange" />
          <AgentRow emoji="🧠" name="SentimentBot_v3" type="Agent" typeClass="bg-[rgba(167,139,250,0.15)] text-az-purple" />
        </Card>
      </div>
    </>
  );
}

function ActivityRow({
  dotClass,
  icon,
  title,
  sub,
  amount,
  positive,
}: {
  dotClass: string;
  icon: ReactNode;
  title: string;
  sub: string;
  amount: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-az-stroke py-2.5 last:border-b-0">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${dotClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-az-text">{title}</div>
        <div className="text-[11px] text-az-muted">{sub}</div>
      </div>
      <div
        className={`shrink-0 text-right text-[13px] font-semibold [font-variant-numeric:tabular-nums] ${
          positive ? "text-[#cdf56a]" : "text-az-red"
        }`}
      >
        {amount}
      </div>
    </div>
  );
}

function AgentRow({
  emoji,
  name,
  type,
  typeClass,
}: {
  emoji: string;
  name: string;
  type: string;
  typeClass: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-az-stroke py-2.5 last:border-b-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#14f195] to-[#9945ff] text-[13px]">
        {emoji}
      </div>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-az-text">{name}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeClass}`}
      >
        {type}
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-az-green shadow-[0_0_0_3px_rgba(182,242,74,0.2)]" />
    </div>
  );
}
