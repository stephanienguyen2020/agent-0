import { LifecycleBarDynamic } from "@/components/tasks/LifecycleBarDynamic";
import { TaskSettlementDetails } from "@/components/tasks/TaskSettlementDetails";
import { TaskDetailActions } from "@/components/TaskDetailActions";
import { Card } from "@/components/ui/Card";
import { CategoryPill, StatusPill } from "@/components/ui/TaskChips";
import { Topbar } from "@/components/shell/Topbar";
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
      <div className="w-full">
        <Topbar title="Task" showSearch={false} />
        <p className="text-sm text-az-muted-2">Task not found or API unavailable.</p>
      </div>
    );
  }

  const status = String(task.status ?? "");

  return (
    <div className="w-full space-y-5">
      <Topbar title={String(task.title ?? "Task")} showSearch={false} />
      <div className="flex flex-wrap items-center gap-2">
        {task.category ? <CategoryPill category={task.category} /> : null}
        <StatusPill status={status} />
      </div>

      <LifecycleBarDynamic status={status} />

      <Card className="p-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-az-muted-2">Instructions</h2>
        <p className="leading-relaxed text-az-text">{String(task.instructions ?? "")}</p>
        <p className="mt-4 az-mono text-xs text-az-muted">Task ID: {String(task.task_id)}</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-az-muted-2">
          Settlement &amp; on-chain
        </h2>
        <TaskSettlementDetails task={task} />
      </Card>

      <TaskDetailActions
        task={{
          task_id: String(task.task_id),
          status,
          title: task.title != null ? String(task.title) : undefined,
        }}
      />
    </div>
  );
}
