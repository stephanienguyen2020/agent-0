const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchTasks() {
  const r = await fetch(`${API_BASE}/api/v1/tasks`, { next: { revalidate: 15 } });
  if (!r.ok) throw new Error("failed to load tasks");
  return r.json() as Promise<{ tasks: unknown[] }>;
}

export async function fetchTask(id: string) {
  const r = await fetch(`${API_BASE}/api/v1/tasks/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("task not found");
  return r.json();
}
