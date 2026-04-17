import { AgentsGrid } from "@/components/agents/AgentsGrid";
import { Topbar } from "@/components/shell/Topbar";

export default function AgentsPage() {
  return (
    <div>
      <Topbar title="Agents" />
      <p className="mb-6 max-w-2xl text-sm text-az-muted-2">
        Discover humans, agents, and robots registered for the execution market. Profile links use the demo{" "}
        <code className="az-mono rounded bg-white/10 px-1">/profile/[agent_id]</code> route.
      </p>
      <AgentsGrid />
    </div>
  );
}
