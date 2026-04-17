import { TasksMarket, type TaskRow } from "@/components/tasks/TasksMarket";
import { Topbar } from "@/components/shell/Topbar";
import { fetchTasks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: TaskRow[] = [];
  let err: string | null = null;
  try {
    const data = await fetchTasks();
    tasks = data.tasks as TaskRow[];
  } catch (e) {
    err = e instanceof Error ? e.message : "error";
  }

  return (
    <div>
      <Topbar title="Market" />
      {err && (
        <p className="mb-6 text-sm text-amber-300/90">
          Could not load tasks ({err}). Set{" "}
          <code className="rounded bg-white/10 px-1 font-mono text-xs">NEXT_PUBLIC_API_URL</code> and run the API.
        </p>
      )}
      <TasksMarket tasks={tasks} />
    </div>
  );
}
