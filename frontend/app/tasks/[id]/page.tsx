import { TaskDetailActions } from "@/components/TaskDetailActions";
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
    return <p className="text-[var(--muted)]">Task not found or API unavailable.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{String(task.title)}</h1>
      <p className="text-sm text-[var(--muted)]">
        {String(task.category)} · {String(task.status)}
      </p>
      <p className="leading-relaxed">{String(task.instructions)}</p>
      <p className="text-xs text-[var(--muted)]">Task ID: {String(task.task_id)}</p>
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
