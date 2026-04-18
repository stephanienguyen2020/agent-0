import Link from "next/link";

import { MyTasksTable } from "@/components/tasks/MyTasksTable";
import type { TaskRow } from "@/components/tasks/TasksMarket";
import { TopbarSimple } from "@/components/shell/Topbar";
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
    <div>
      <TopbarSimple title="My Tasks">
        <Link
          href="/tasks/new"
          className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-az-btn-green px-5 text-[13px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px"
        >
          <IconPlus className="h-4 w-4" />
          Post New Task
        </Link>
      </TopbarSimple>

      {err && (
        <p className="mb-4 text-sm text-amber-300/90">
          Could not load tasks ({err}). Configure the API to see your tasks here.
        </p>
      )}

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-az-muted-2">
        Stages: Published → Accepted → In progress → Submitted → Verifying → Completed. Open a task for the
        full lifecycle bar, settlement amounts, timestamps, and transaction links on opBNBScan.
      </p>
      <MyTasksTable tasks={tasks} />
    </div>
  );
}
