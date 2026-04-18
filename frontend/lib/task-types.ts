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
};
