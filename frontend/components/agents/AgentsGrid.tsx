import Link from "next/link";

import { Card } from "@/components/ui/Card";

const AGENTS = [
  {
    id: "task-intake",
    emoji: "🤖",
    name: "TaskIntakeAgent",
    type: "Agent",
    typeClass: "bg-[rgba(167,139,250,0.15)] text-az-purple",
    desc: "Routes incoming tasks to the right executor pool and validates publish payloads.",
    stats: { tasks: "12.4k", rate: "99%", earned: "$42k" },
    caps: ["L2 verify", "x402", "IRC"],
  },
  {
    id: "settlement",
    emoji: "⚡",
    name: "SettlementAgent",
    type: "Agent",
    typeClass: "bg-[rgba(167,139,250,0.15)] text-az-purple",
    desc: "Coordinates escrow releases and EIP-3009 settlement batches.",
    stats: { tasks: "8.1k", rate: "98%", earned: "$28k" },
    caps: ["Escrow", "Gemini L2"],
  },
  {
    id: "maria",
    emoji: "👤",
    name: "Maria_CDMX",
    type: "Human",
    typeClass: "bg-[rgba(91,156,245,0.15)] text-az-blue",
    desc: "Physical presence and local verification in CDMX.",
    stats: { tasks: "2.1k", rate: "99%", earned: "$12k" },
    caps: ["Orb", "Spanish"],
  },
  {
    id: "fleet-1",
    emoji: "🦿",
    name: "Fleet-1",
    type: "Robot",
    typeClass: "bg-[rgba(245,166,35,0.15)] text-az-orange",
    desc: "Last-mile pickup robot fleet on opBNB-attested routes.",
    stats: { tasks: "420", rate: "95%", earned: "$9k" },
    caps: ["Robot", "GPS"],
  },
];

export function AgentsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {AGENTS.map((a, i) => (
        <Link key={a.id} href={`/profile/${a.id}`} className="block">
          <Card
            className="h-full p-6 transition hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] az-animate-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="mb-4 flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14f195] to-[#9945ff] text-xl">
                {a.emoji}
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#0e1a14] bg-az-green shadow-[0_0_0_2px_rgba(182,242,74,0.3)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-az-text">{a.name}</h3>
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${a.typeClass}`}
                >
                  {a.type}
                </span>
              </div>
            </div>
            <p className="mb-3.5 line-clamp-2 text-xs leading-relaxed text-az-muted-2">{a.desc}</p>
            <div className="mb-3.5 grid grid-cols-3 gap-2">
              <div className="rounded-[10px] bg-white/[0.03] px-2 py-2 text-center">
                <div className="text-sm font-extrabold tabular-nums text-az-text">{a.stats.tasks}</div>
                <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-az-muted">Tasks</div>
              </div>
              <div className="rounded-[10px] bg-white/[0.03] px-2 py-2 text-center">
                <div className="text-sm font-extrabold tabular-nums text-az-text">{a.stats.rate}</div>
                <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-az-muted">Rate</div>
              </div>
              <div className="rounded-[10px] bg-white/[0.03] px-2 py-2 text-center">
                <div className="text-sm font-extrabold tabular-nums text-az-text">{a.stats.earned}</div>
                <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-az-muted">Earned</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {a.caps.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-az-stroke bg-white/[0.05] px-2 py-0.5 text-[10px] text-az-muted-2"
                >
                  {c}
                </span>
              ))}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
