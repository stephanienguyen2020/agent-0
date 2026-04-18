import Link from "next/link";

import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { LifecycleBar, MyTasksTable } from "@/components/tasks/MyTasksTable";
import type { TaskRow } from "@/components/tasks/TasksMarket";
import { IconPlus } from "@/components/ui/Button";
import { fetchTasks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  let tasks: TaskRow[] = [];
  let err: string | null = null;
  try {
    const data = await fetchTasks();
    tasks = data.tasks as TaskRow[];
  } catch (e) {
    err = e instanceof Error ? e.message : "error";
  }

  return (
    <EditorialPageShell
      title="My tasks"
      actions={
        <Link
          href="/tasks/new"
          className="group/dashboard-cta dashboard-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--ink)] bg-[color:var(--ink)] px-[22px] text-[13px] font-semibold text-[color:var(--bg)] [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] sm:w-auto"
        >
          <IconPlus className="h-4 w-4" />
          Post new task
          <span
            aria-hidden
            className="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] group-hover/dashboard-cta:translate-x-1"
          >
            →
          </span>
        </Link>
      }
    >
      {err ? (
        <div
          className="dashboard-reveal mb-6 rounded-[12px] border border-[color:color-mix(in_oklab,var(--danger)_40%,var(--line))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--card))] px-4 py-3 text-sm leading-relaxed text-[color:var(--danger)]"
          role="alert"
        >
          Could not load tasks ({err}). Configure the API to see your tasks here.
        </div>
      ) : null}

      <LifecycleBar />
      <MyTasksTable tasks={tasks} />
    </EditorialPageShell>
  );
}
