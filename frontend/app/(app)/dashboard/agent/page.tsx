import Link from "next/link";

import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Card } from "@/components/ui/Card";

export default function AgentDashboardPage() {
  return (
    <EditorialPageShell title="Agent dashboard" showSearch={false}>
      <div className="max-w-2xl space-y-4">
        <Card className="p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">
            Agent-specific metrics and registrations. Browse the public{" "}
            <Link href="/agents" className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline">
              Agents
            </Link>{" "}
            directory.
          </p>
        </Card>
      </div>
    </EditorialPageShell>
  );
}
