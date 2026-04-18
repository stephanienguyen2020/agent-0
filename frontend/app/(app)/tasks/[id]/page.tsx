import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { LifecycleBarDynamic } from "@/components/tasks/LifecycleBarDynamic";
import { TaskSettlementDetails } from "@/components/tasks/TaskSettlementDetails";
import { TaskDetailActions } from "@/components/TaskDetailActions";
import { Card } from "@/components/ui/Card";
import { CategoryPill, StatusPill } from "@/components/ui/TaskChips";
import { fetchTask } from "@/lib/api";
import type { TaskApiRecord } from "@/lib/task-types";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: TaskApiRecord | null = null;
  let err: string | null = null;
  try {
    task = (await fetchTask(id)) as TaskApiRecord;
  } catch (e) {
    err = e instanceof Error ? e.message : "error";
  }

  if (err || !task) {
    return (
      <EditorialPageShell title="Task" showSearch={false}>
        <p className="dashboard-reveal dashboard-reveal-d3 text-sm text-[color:var(--ink-2)]">
          Task not found or API unavailable.
        </p>
      </EditorialPageShell>
    );
  }

  const status = String(task.status ?? "");
  const titleStr = String(task.title ?? "Task");

  return (
    <EditorialPageShell title={titleStr} showSearch={false}>
      <div className="w-full space-y-5">
        <div className="dashboard-reveal dashboard-reveal-d3 flex flex-wrap items-center gap-2">
          {task.category ? <CategoryPill category={task.category} /> : null}
          <StatusPill status={status} />
        </div>

        <LifecycleBarDynamic status={status} />

        <Card className="dashboard-reveal dashboard-reveal-d3 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--mute)]">
            Instructions
          </h2>
          <p className="leading-relaxed text-[color:var(--ink)]">{String(task.instructions ?? "")}</p>
          <p className="mt-4 font-mono text-xs text-[color:var(--mute)]">
            Task ID: {String(task.task_id)}
          </p>
        </Card>

        <Card className="dashboard-reveal dashboard-reveal-d4 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--mute)]">
            Settlement &amp; on-chain
          </h2>
          <TaskSettlementDetails task={task} />
        </Card>

        <TaskDetailActions
          task={{
            task_id: String(task.task_id),
            status,
            title: task.title != null ? String(task.title) : undefined,
            requester_wallet: task.requester_wallet != null ? String(task.requester_wallet) : undefined,
            executor_wallet: task.executor_wallet != null ? String(task.executor_wallet) : undefined,
            requester_approval_before_verify: task.requester_approval_before_verify,
            evidence_items: task.evidence_items,
          }}
        />
      </div>
    </EditorialPageShell>
  );
}
