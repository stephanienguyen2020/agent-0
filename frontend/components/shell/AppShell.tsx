import { fetchTasks } from "@/lib/api";

import { Sidebar } from "@/components/shell/Sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let marketCount: number | undefined;
  try {
    const data = await fetchTasks();
    marketCount = data.tasks.length;
  } catch {
    marketCount = undefined;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar marketCount={marketCount} />
      <div className="min-w-0 flex-1 px-6 py-7 sm:px-8">{children}</div>
    </div>
  );
}
