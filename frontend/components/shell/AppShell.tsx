import { fetchTasks } from "@/lib/api";

import { AppShellClient } from "@/components/shell/AppShellClient";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let marketCount: number | undefined;
  try {
    const data = await fetchTasks();
    marketCount = data.tasks.length;
  } catch {
    marketCount = undefined;
  }

  return <AppShellClient marketCount={marketCount}>{children}</AppShellClient>;
}
