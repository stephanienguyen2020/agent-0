-- EMEscrow.dispute tx hash for lifecycle UI / wallet activity

alter table public.tasks
  add column if not exists on_chain_tx_dispute text;

comment on column public.tasks.on_chain_tx_dispute is 'EMEscrow.dispute(taskId, reason) tx hash';
