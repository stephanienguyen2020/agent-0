import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/shell/Topbar";

export default function ExecutorDashboardPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <Topbar title="Executor dashboard" showSearch={false} />
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-az-muted-2">
          Connect wallet, World ID, and browse assigned tasks (wagmi + IDKit). Use{" "}
          <Link href="/my-tasks" className="font-semibold text-[#cdf56a] hover:underline">
            My Tasks
          </Link>{" "}
          for the full table view.
        </p>
      </Card>
    </div>
  );
}
