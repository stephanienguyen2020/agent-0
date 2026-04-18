import { fetchTasks } from "@/lib/api";
import { LandingClient } from "./LandingClient";

export const revalidate = 15;

export type ApiTask = {
  task_id: string | number;
  title: string;
  category: string;
  status: string;
  bounty_micros?: string | number;
  instructions?: string;
  created_at?: string;
  deadline_at?: string;
  chain?: string;
  city?: string;
};

function calendarDaysWithTasks(tasks: ApiTask[], year: number, month: number): number[] {
  const days = new Set<number>();
  for (const t of tasks) {
    const raw = t.deadline_at ?? t.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() === year && d.getMonth() === month) {
      days.add(d.getDate());
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

export default async function LandingPage() {
  let tasks: ApiTask[] = [];
  let totalPool = 0;
  let tasksLoadFailed = false;

  try {
    const data = await fetchTasks({ status: "published" });
    tasks = data.tasks as ApiTask[];
    totalPool = tasks.reduce((sum, t) => {
      const n = typeof t.bounty_micros === "string" ? Number(t.bounty_micros) : (t.bounty_micros ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  } catch {
    tasksLoadFailed = true;
  }

  const openCount = tasks.length;
  const poolFormatted = totalPool >= 1_000_000_000
    ? `$${(totalPool / 1_000_000_000).toFixed(1)}K`
    : totalPool >= 1_000_000
    ? `$${(totalPool / 1_000_000).toFixed(0)}`
    : `$${(totalPool / 1_000_000).toFixed(2)}`;

  const now = new Date();
  const calendarYear = now.getFullYear();
  const calendarMonth = now.getMonth();
  const calendarActiveDays = calendarDaysWithTasks(tasks, calendarYear, calendarMonth);
  const calendarTodayDay =
    now.getFullYear() === calendarYear && now.getMonth() === calendarMonth
      ? now.getDate()
      : null;

  return (
    <LandingClient
      tasks={tasks.slice(0, 12)}
      openCount={openCount}
      poolFormatted={poolFormatted}
      tasksLoadFailed={tasksLoadFailed}
      calendarYear={calendarYear}
      calendarMonth={calendarMonth}
      calendarActiveDays={calendarActiveDays}
      calendarTodayDay={calendarTodayDay}
    />
  );
}
