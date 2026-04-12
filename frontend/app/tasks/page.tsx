import Link from "next/link";
import { fetchTasks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: unknown[] = [];
  let err: string | null = null;
  try {
    const data = await fetchTasks();
    tasks = data.tasks;
  } catch (e) {
    err = e instanceof Error ? e.message : "error";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Open tasks</h1>
      {err && (
        <p className="text-sm text-amber-300">
          Could not load tasks ({err}). Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_API_URL</code> and
          run the API.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(tasks as Record<string, string>[]).map((t) => (
          <li key={t.task_id} className="rounded-xl border border-white/10 p-4">
            <Link href={`/tasks/${t.task_id}`} className="font-medium text-[var(--accent)] hover:underline">
              {t.title}
            </Link>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t.category} · {t.status} · bounty {t.bounty_micros} µUSDC
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
