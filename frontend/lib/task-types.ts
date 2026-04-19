/** Latest submission’s files from `evidence_items` (GET task single). */
export type TaskEvidenceItem = {
  /** `evidence_items.id` — used for `/api/v1/evidence-files/{id}` when serving local dev uploads. */
  id?: string;
  item_index: number;
  filename: string;
  content_type: string;
  greenfield_url: string;
  exif_gps_lat?: number;
  exif_gps_lng?: number;
  exif_timestamp?: string;
};

/** Fields returned by GET /api/v1/tasks/:id (Supabase tasks row + joins not included). */
export type TaskApiRecord = {
  task_id: string;
  title?: string;
  instructions?: string;
  category?: string;
  status?: string;
  bounty_micros?: string | number;
  fee_micros?: string | number;
  token?: string;
  created_at?: string;
  updated_at?: string;
  deadline_at?: string;
  accepted_at?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  settled_at?: string | null;
  on_chain_task_id?: string | null;
  on_chain_tx_publish?: string | null;
  on_chain_tx_x402_settle?: string | null;
  on_chain_tx_accept?: string | null;
  on_chain_tx_submit?: string | null;
  on_chain_tx_verify?: string | null;
  on_chain_tx_release?: string | null;
  on_chain_tx_refund?: string | null;
  /** Joined from `agents` via `agent_id` (GET task single). */
  requester_wallet?: string | null;
  /** Joined from `executors` via `executor_id`. */
  executor_wallet?: string | null;
  /** Mirrors server `REQUESTER_APPROVAL_BEFORE_VERIFY`. */
  requester_approval_before_verify?: boolean;
  /** Latest evidence submission items for preview (task detail). */
  evidence_items?: TaskEvidenceItem[];
};
