import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/shell/Topbar";

export default function AgentDashboardPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <Topbar title="Agent dashboard" showSearch={false} />
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-az-muted-2">
          Agent-specific metrics and registrations. Browse the public{" "}
          <Link href="/agents" className="font-semibold text-[#cdf56a] hover:underline">
            Agents
          </Link>{" "}
          directory.
        </p>
      </Card>
    </div>
  );
}
