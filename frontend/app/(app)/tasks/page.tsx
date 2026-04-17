import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { TasksMarket, type TaskRow } from "@/components/tasks/TasksMarket";
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
    <EditorialPageShell title="Market">
      {err ? (
        <div
          className="dashboard-reveal mb-6 rounded-[12px] border border-[color:color-mix(in_oklab,var(--accent-2)_45%,var(--line))] bg-[color:color-mix(in_oklab,var(--accent-2)_8%,var(--card))] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink-2)]"
          role="alert"
        >
          Could not load tasks ({err}). Set{" "}
          <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[12px] text-[color:var(--ink)]">
            NEXT_PUBLIC_API_URL
          </code>{" "}
          and run the API.
        </div>
      ) : null}
      <TasksMarket tasks={tasks} />
    </EditorialPageShell>
  );
}
