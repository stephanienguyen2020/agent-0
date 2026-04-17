import { getApiBase } from "@/lib/api-base";
import { ESCROW_FEE_BPS } from "@/lib/constants";

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

export async function fetchTask(id: string) {
  const r = await fetch(`${API_BASE}/api/v1/tasks/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("task not found");
  return r.json();
}
