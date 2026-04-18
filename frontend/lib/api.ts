import { getApiBase } from "@/lib/api-base";
import { ESCROW_FEE_BPS } from "@/lib/constants";
import type { TaskApiRecord } from "@/lib/task-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Basis points charged by deployed EMEscrow — use for EIP-3009 totals (fallback: `ESCROW_FEE_BPS`). */
export async function getEscrowFeeBps(): Promise<number> {
  const r = await fetch(`${getApiBase()}/api/v1/tasks/escrow-fee-bps`, { cache: "no-store" });
  if (!r.ok) return ESCROW_FEE_BPS;
  const j = (await r.json()) as { fee_bps?: unknown };
  return typeof j.fee_bps === "number" && j.fee_bps >= 0 && j.fee_bps <= 10_000 ? j.fee_bps : ESCROW_FEE_BPS;
}

/** Parse FastAPI `{ "detail": "..." }` (or validation array) for display. */
export function parseFastApiDetail(body: string): string {
  const t = body.trim();
  if (!t) return "Request failed";
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((x) =>
          typeof x === "object" && x !== null && "msg" in x
            ? String((x as { msg: unknown }).msg)
            : String(x),
        )
        .join("; ");
    }
  } catch {
    /* plain text */
  }
  return t;
}

export type TaskCreateBody = {
  requester_wallet: string;
  requester_erc8004_id: number;
  title: string;
  instructions: string;
  category: string;
  bounty_micros: number;
  deadline_at: string;
  evidence_schema?: Record<string, unknown>;
  executor_requirements?: Record<string, unknown>;
};

export type CreateTaskResponse = {
  task_id: string;
  on_chain_tx_publish?: string;
  on_chain_tx_x402_settle?: string;
};

export async function createTask(
  body: TaskCreateBody,
  opts?: { xPayment?: string; xPaymentSkip?: boolean },
): Promise<CreateTaskResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.xPayment) headers["X-PAYMENT"] = opts.xPayment;
  if (opts?.xPaymentSkip) headers["X-PAYMENT-SKIP"] = "1";

  const r = await fetch(`${getApiBase()}/api/v1/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(parseFastApiDetail(text) || `${r.status} ${r.statusText}`);
  }
  return JSON.parse(text) as CreateTaskResponse;
}

export async function fetchTasks() {
  const r = await fetch(`${API_BASE}/api/v1/tasks`, { next: { revalidate: 15 } });
  if (!r.ok) throw new Error("failed to load tasks");
  return r.json() as Promise<{ tasks: unknown[] }>;
}

export async function fetchTask(id: string): Promise<TaskApiRecord> {
  const r = await fetch(`${API_BASE}/api/v1/tasks/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("task not found");
  return r.json() as Promise<TaskApiRecord>;
}

export type LeaderboardExecutor = {
  rank: number;
  executor_id: string;
  display_name: string;
  type: string;
  wallet: string | null;
  score: number;
  rating_bps: number;
  tasks_completed: number;
  tasks_disputed: number;
  dispute_losses: number;
  total_earned_micros: string;
};

export async function fetchLeaderboard(opts?: {
  type?: "all" | "human" | "agent" | "robot";
  limit?: number;
}): Promise<{ executors: LeaderboardExecutor[] }> {
  const params = new URLSearchParams();
  const t = opts?.type;
  if (t && t !== "all") params.set("type", t);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = `${getApiBase()}/api/v1/leaderboard${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(parseFastApiDetail(text) || `${r.status} ${r.statusText}`);
  }
  return JSON.parse(text) as { executors: LeaderboardExecutor[] };
}

export type WalletActivityItem = {
  id: string;
  task_id: string;
  title: string;
  status?: string;
  role: string;
  kind: string;
  bucket: "spent" | "earned" | "escrow";
  tx_hash: string;
  occurred_at: string | null;
};

export async function fetchWalletActivity(
  wallet: string,
  opts?: { limit?: number },
): Promise<{ wallet: string; items: WalletActivityItem[] }> {
  const params = new URLSearchParams();
  params.set("wallet", wallet);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const r = await fetch(`${getApiBase()}/api/v1/wallet/activity?${params}`, { cache: "no-store" });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(parseFastApiDetail(text) || `${r.status} ${r.statusText}`);
  }
  return JSON.parse(text) as { wallet: string; items: WalletActivityItem[] };
}

export async function fetchWalletEscrowLocked(wallet: string): Promise<{
  wallet: string;
  locked_micros: string;
  task_count: number;
}> {
  const params = new URLSearchParams();
  params.set("wallet", wallet);
  const r = await fetch(`${getApiBase()}/api/v1/wallet/escrow-locked?${params}`, { cache: "no-store" });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(parseFastApiDetail(text) || `${r.status} ${r.statusText}`);
  }
  return JSON.parse(text) as { wallet: string; locked_micros: string; task_count: number };
}
