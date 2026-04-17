import Link from "next/link";

import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Card } from "@/components/ui/Card";

export default function ExecutorDashboardPage() {
  return (
    <EditorialPageShell title="Executor dashboard" showSearch={false}>
      <div className="max-w-2xl space-y-4">
        <Card className="p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">
            Connect wallet, World ID, and browse assigned tasks (wagmi + IDKit). Use{" "}
            <Link href="/my-tasks" className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline">
              My tasks
            </Link>{" "}
            for the full table view.
          </p>
        </Card>
      </div>
    </EditorialPageShell>
  );
}
