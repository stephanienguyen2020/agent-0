import { TaskDetailActions } from "@/components/TaskDetailActions";
import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/shell/Topbar";
import { fetchTask } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: Record<string, unknown> | null = null;
  let err: string | null = null;
  try {
    task = (await fetchTask(id)) as Record<string, unknown>;
  } catch (e) {
    err = e instanceof Error ? e.message : "error";
  }

  if (err || !task) {
    return (
      <div>
        <Topbar title="Task" showSearch={false} />
        <p className="text-sm text-az-muted-2">Task not found or API unavailable.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Topbar title={String(task.title ?? "Task")} showSearch={false} />
      <p className="text-sm text-az-muted-2">
        {String(task.category)} · {String(task.status)}
      </p>
      <Card className="p-5">
        <p className="leading-relaxed text-az-text">{String(task.instructions ?? "")}</p>
        <p className="mt-4 az-mono text-xs text-az-muted">Task ID: {String(task.task_id)}</p>
      </Card>
      <TaskDetailActions
        task={{
          task_id: String(task.task_id),
          status: String(task.status),
          title: task.title != null ? String(task.title) : undefined,
        }}
      />
    </div>
  );
}
