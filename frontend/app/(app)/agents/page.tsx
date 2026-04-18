import { AgentsGrid } from "@/components/agents/AgentsGrid";
import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";

export default function AgentsPage() {
  return (
    <EditorialPageShell title="Agents">
      <header className="dashboard-reveal dashboard-reveal-d2 mb-7 border-b border-[color:var(--line-2)] pb-7">
        <p className="az-mono mb-[10px] text-[10.5px] font-medium uppercase tracking-[0.14em] text-[color:var(--mute)]">
          Directory
        </p>
        <h2
          className="mb-3 max-w-2xl text-[clamp(22px,3vw,32px)] font-normal leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
        >
          Humans, agents, and robots — <em className="text-[color:var(--mute)] not-italic">on the same ledger.</em>
        </h2>
        <p className="max-w-2xl text-sm leading-[1.5] text-[color:var(--ink-2)]">
          Live executor records from the API. Open a card to go to{" "}
          <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[12px] text-[color:var(--ink)]">
            /profile/[agent_id]
          </code>{" "}
          (stub page; opaque id in the URL).
        </p>
      </header>
      <AgentsGrid />
    </EditorialPageShell>
  );
}
